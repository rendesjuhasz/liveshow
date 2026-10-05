import { apiFetch, apiUpload } from "@/api/http";
import { connectLiveSocket } from "@/lib/live-socket";
import { fetchLiveVideoConfig } from "@/lib/livekit-session";
import { startStreamerMedia, stopStreamerMedia } from "@/components/StreamerLiveCamera";
import type { PreflightGrade } from "@/lib/live-link-quality";

export type CheckState = "idle" | "pending" | "ok" | "fail";

export type PreflightLast = {
    lastPreflightAt: string | null;
    lastPreflightGrade: PreflightGrade | null;
    stale: boolean;
    ageMs: number | null;
};

export type PreflightRunResult = {
    camera: CheckState;
    mic: CheckState;
    network: CheckState;
    ingest: CheckState;
    cameraDetail: string;
    micDetail: string;
    networkDetail: string;
    ingestDetail: string;
    pingMs: number | null;
    jitterMs: number | null;
    lossPct: number | null;
    uploadMbps: number | null;
    videoPackets: boolean;
    audioPackets: boolean;
    grade: PreflightGrade;
    liveOk: boolean;
    recommended: { label: string; height: number; fps: number; bitrate: "normal" | "low" };
    warning: string | null;
};

type ProgressFn = (partial: Partial<PreflightRunResult>) => void;

function fillUploadProbe(bytes: number) {
    const payload = new Uint8Array(bytes);
    for (let i = 0; i < payload.byteLength; i++) payload[i] = (i * 73 + 19) & 255;
    return payload;
}

function wait(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function cameraErrorHu(err: unknown) {
    const name = err && typeof err === "object" && "name" in err ? String((err as DOMException).name) : "";
    const msg = err instanceof Error ? err.message : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        return "Nincs kamera jogosultság. Engedélyezd a kamerát a böngészőben.";
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
        return "Nem található kamera.";
    }
    if (name === "NotReadableError") {
        return "A kamera foglalt (másik app használja).";
    }
    return msg || "A kamera nem indult el.";
}

function micErrorHu(err: unknown) {
    const name = err && typeof err === "object" && "name" in err ? String((err as DOMException).name) : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        return "Nincs mikrofon jogosultság.";
    }
    if (name === "NotFoundError") return "Nem található mikrofon.";
    return err instanceof Error ? err.message : "A mikrofon nem indult el.";
}

async function videoHasFrames(stream: MediaStream) {
    const track = stream.getVideoTracks()[0];
    if (!track || track.readyState !== "live") return false;
    const settings = track.getSettings();
    if ((settings.width || 0) >= 16 && (settings.height || 0) >= 16) return true;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play().catch(() => undefined);
    await wait(400);
    const ok = video.videoWidth > 8 && video.videoHeight > 8;
    video.pause();
    video.srcObject = null;
    return ok;
}

async function micHasLevel(stream: MediaStream) {
    const track = stream.getAudioTracks()[0];
    if (!track || track.readyState !== "live") return false;
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const started = Date.now();
    let peak = 0;
    while (Date.now() - started < 1100) {
        analyser.getByteTimeDomainData(data);
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
        if (peak > 6) break;
        await wait(80);
    }
    await ctx.close().catch(() => undefined);
    return peak > 4;
}

async function measureNetwork(onTick?: ProgressFn) {
    const rtts: number[] = [];
    let lost = 0;
    const rounds = 5;
    for (let i = 0; i < rounds; i++) {
        const t0 = performance.now();
        try {
            await apiFetch("/streamer/preflight/echo");
            rtts.push(performance.now() - t0);
        } catch {
            lost += 1;
        }
        onTick?.({
            pingMs: rtts.length ? Math.round(rtts.reduce((a, b) => a + b, 0) / rtts.length) : null,
            lossPct: Math.round((lost / (i + 1)) * 1000) / 10,
        });
    }
    const ping = rtts.length ? rtts.reduce((a, b) => a + b, 0) / rtts.length : null;
    const jitter =
        rtts.length > 1
            ? rtts.slice(1).reduce((sum, v, i) => sum + Math.abs(v - rtts[i]), 0) / (rtts.length - 1)
            : rtts.length
              ? 0
              : null;
    const payload = fillUploadProbe(512 * 1024);
    const form = new FormData();
    form.append("chunk", new Blob([payload], { type: "application/octet-stream" }), "chunk.bin");
    form.append("startedAt", String(Date.now()));
    const start = Date.now();
    const up = await apiUpload("/streamer/preflight/upload", form);
    const clientMs = Math.max(1, Date.now() - start);
    const clientMbps = (payload.byteLength * 8) / clientMs / 1000;
    const uploadMbps = Math.min(Number(up?.uploadMbps) || clientMbps, clientMbps);
    return {
        pingMs: ping == null ? null : Math.round(ping),
        jitterMs: jitter == null ? null : Math.round(jitter),
        lossPct: Math.round((lost / rounds) * 1000) / 10,
        uploadMbps: Math.round(Math.max(0, uploadMbps) * 100) / 100,
        ok: ping != null && lost / rounds <= 0.25 && uploadMbps >= 0.4,
    };
}

function pickRecorderMime() {
    const types = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
    return types.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) || "";
}

function recordClip(stream: MediaStream, ms: number) {
    return new Promise<Blob>((resolve, reject) => {
        const mime = pickRecorderMime();
        let rec: MediaRecorder;
        try {
            rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
        } catch (err) {
            reject(err);
            return;
        }
        const chunks: Blob[] = [];
        rec.ondataavailable = (ev) => {
            if (ev.data?.size) chunks.push(ev.data);
        };
        rec.onerror = () => reject(new Error("A próba felvétel megszakadt."));
        rec.onstop = () => {
            resolve(new Blob(chunks, { type: rec.mimeType || mime || "video/webm" }));
        };
        rec.start(400);
        window.setTimeout(() => {
            try {
                rec.stop();
            } catch {
                reject(new Error("A próba felvétel nem állt le."));
            }
        }, ms);
    });
}

async function emitPreflightPing() {
    const socket = await connectLiveSocket(true);
    try {
        const reply = await new Promise<{ ok?: boolean }>((resolve, reject) => {
            const timer = window.setTimeout(() => {
                if (socket.connected) resolve({ ok: true });
                else reject(new Error("A jelzőszerver nem válaszol."));
            }, 4000);
            socket.emit("preflight:ping", {}, (res: { ok?: boolean }) => {
                window.clearTimeout(timer);
                resolve(res || { ok: socket.connected });
            });
        });
        if (!reply.ok && !socket.connected) {
            throw new Error("A stream szerver nem igazolta a kapcsolatot.");
        }
    } finally {
        socket.disconnect();
    }
}

export async function fetchPreflightLast(): Promise<PreflightLast> {
    const data = await apiFetch("/streamer/preflight");
    return {
        lastPreflightAt: data?.lastPreflightAt || null,
        lastPreflightGrade: data?.lastPreflightGrade || null,
        stale: Boolean(data?.stale),
        ageMs: data?.ageMs ?? null,
    };
}

export async function runPreflight(onProgress: ProgressFn): Promise<PreflightRunResult> {
    const result: PreflightRunResult = {
        camera: "pending",
        mic: "pending",
        network: "pending",
        ingest: "pending",
        cameraDetail: "Ellenőrzés...",
        micDetail: "Ellenőrzés...",
        networkDetail: "Ellenőrzés...",
        ingestDetail: "Ellenőrzés...",
        pingMs: null,
        jitterMs: null,
        lossPct: null,
        uploadMbps: null,
        videoPackets: false,
        audioPackets: false,
        grade: "critical",
        liveOk: false,
        recommended: { label: "720p / 30 FPS (alacsony bitrate)", height: 720, fps: 30, bitrate: "low" },
        warning: null,
    };
    onProgress({ ...result });

    let stream: MediaStream | null = null;
    try {
        if (!window.isSecureContext) {
            throw new Error("HTTP-n a kamera tiltva van. Nyisd a HTTPS (Cloudflare) címet.");
        }
        stream = await startStreamerMedia();
        const camOk = await videoHasFrames(stream);
        result.camera = camOk ? "ok" : "fail";
        result.cameraDetail = camOk ? "Kamera elérhető, van videójel." : "Van kamera, de nem érkezik kép.";
        onProgress({ camera: result.camera, cameraDetail: result.cameraDetail });

        try {
            const micOk = stream.getAudioTracks().length > 0 && (await micHasLevel(stream));
            result.mic = micOk ? "ok" : "fail";
            result.micDetail = micOk
                ? "Mikrofon elérhető, van hangbemenet."
                : stream.getAudioTracks().length
                  ? "A mikrofon csendes. Beszélj egy mondatot, majd indítsd újra."
                  : "Nincs mikrofon sáv.";
        } catch (err) {
            result.mic = "fail";
            result.micDetail = micErrorHu(err);
        }
        onProgress({ mic: result.mic, micDetail: result.micDetail });
    } catch (err) {
        result.camera = "fail";
        result.cameraDetail = cameraErrorHu(err);
        result.mic = "fail";
        result.micDetail = "Kamera nélkül a mikrofon teszt kimaradt.";
        onProgress({
            camera: result.camera,
            cameraDetail: result.cameraDetail,
            mic: result.mic,
            micDetail: result.micDetail,
        });
    }

    try {
        const net = await measureNetwork((partial) => onProgress(partial));
        result.pingMs = net.pingMs;
        result.jitterMs = net.jitterMs;
        result.lossPct = net.lossPct;
        result.uploadMbps = net.uploadMbps;
        result.network = net.ok ? "ok" : "fail";
        result.networkDetail = net.ok
            ? `Ping ${net.pingMs} ms · jitter ${net.jitterMs} ms · vesztés ${net.lossPct}% · feltöltés ${net.uploadMbps} Mbps`
            : "A hálózati mérés gyenge vagy megszakadt.";
    } catch (err) {
        result.network = "fail";
        result.networkDetail = err instanceof Error ? err.message : "A hálózati teszt nem futott le.";
    }
    onProgress({
        network: result.network,
        networkDetail: result.networkDetail,
        pingMs: result.pingMs,
        jitterMs: result.jitterMs,
        lossPct: result.lossPct,
        uploadMbps: result.uploadMbps,
    });

    try {
        const ingest = await apiFetch("/streamer/preflight/ingest");
        await emitPreflightPing();
        let videoCfg: { configured?: boolean } | null = null;
        try {
            videoCfg = await fetchLiveVideoConfig("");
        } catch {
            videoCfg = null;
        }
        if (videoCfg?.configured || ingest?.livekitRequired) {
            try {
                const lk = await apiFetch("/health/livekit");
                if (lk?.status === "error") {
                    throw new Error("A LiveKit szerver nem elérhető.");
                }
            } catch (err) {
                if (ingest?.livekitRequired) throw err;
            }
        }
        let videoPackets = false;
        let audioPackets = false;
        if (stream) {
            const clip = await recordClip(stream, 3200);
            if (clip.size < 2048) throw new Error("A próba stream üres.");
            const form = new FormData();
            form.append("clip", clip, clip.type.includes("mp4") ? "probe.mp4" : "probe.webm");
            const probed = await apiUpload("/streamer/preflight/probe", form);
            videoPackets = Boolean(probed?.video);
            audioPackets = Boolean(probed?.audio);
        }
        const ok = Boolean(ingest?.ok) && videoPackets && audioPackets;
        result.videoPackets = videoPackets;
        result.audioPackets = audioPackets;
        result.ingest = ok ? "ok" : "fail";
        result.ingestDetail = ok
            ? "Ingest elérhető, a próba videó- és hangcsomagok megérkeztek."
            : !ingest?.ok
              ? "Az ingest szerver nem elérhető."
              : "A próba stream nem tartalmazott videót és hangot.";
    } catch (err) {
        result.ingest = "fail";
        result.ingestDetail = err instanceof Error ? err.message : "A stream szerver teszt sikertelen.";
    } finally {
        stopStreamerMedia(stream);
    }
    onProgress({
        ingest: result.ingest,
        ingestDetail: result.ingestDetail,
        videoPackets: result.videoPackets,
        audioPackets: result.audioPackets,
    });

    const saved = await apiFetch("/streamer/preflight", {
        method: "POST",
        body: JSON.stringify({
            cameraOk: result.camera === "ok",
            micOk: result.mic === "ok",
            networkOk: result.network === "ok",
            ingestOk: result.ingest === "ok",
            videoPackets: result.videoPackets,
            audioPackets: result.audioPackets,
            pingMs: result.pingMs ?? undefined,
            jitterMs: result.jitterMs ?? undefined,
            lossPct: result.lossPct ?? undefined,
            uploadMbps: result.uploadMbps ?? undefined,
        }),
    });
    result.grade = saved?.grade || "critical";
    result.liveOk = Boolean(saved?.liveOk);
    result.recommended = saved?.recommended || result.recommended;
    result.warning = saved?.warning || null;
    onProgress({
        grade: result.grade,
        liveOk: result.liveOk,
        recommended: result.recommended,
        warning: result.warning,
    });
    return result;
}
