export type AlertSeverity = "info" | "warning" | "critical";

export type AlertDraft = {
    type: string;
    severity: AlertSeverity;
    title: string;
    message: string;
    recommendation: string;
};

export type StreamSample = {
    showId: string;
    streamId: string;
    ingestAlive: boolean;
    showLive: boolean;
    fps?: number;
    bitrateKbps?: number;
    dropped?: number;
    speed?: number;
    encoderStall?: boolean;
    hlsAgeMs?: number;
    viewers: number;
    viewersAgo5m?: number;
    chatLastMin: number;
    chatPrevMin: number;
    ticketsLast5m: number;
    ticketsPrev5m: number;
    duplicateQuestions: number;
    topQuestion?: string;
    cpuPct: number;
    ramPct: number;
    dbLatencyMs: number;
};

export type TrendPoint = { t: number; cpu: number; viewers: number };

export function evaluateAlerts(s: StreamSample, trend: TrendPoint[]): AlertDraft[] {
    const out: AlertDraft[] = [];
    const now = Date.now();

    if (s.showLive && !s.ingestAlive) {
        out.push({
            type: "ingest_down",
            severity: "critical",
            title: "Ingest kapcsolat megszakadt",
            message: "A műsor élőnek van jelölve, de az FFmpeg ingest nem fut.",
            recommendation: "Indítsd újra az élő adást a tartalomkészítő felületen, és ellenőrizd az OBS UDP célportot.",
        });
    }
    if (s.encoderStall) {
        out.push({
            type: "packet_loss",
            severity: "critical",
            title: "Csomagvesztés / hibás bemenet",
            message: "Az FFmpeg hibát vagy timeoutot jelzett a UDP ingesten.",
            recommendation: "Csökkentsd a bitrate-et 3500 kbps környékére, és ellenőrizd a hálózati tûzfalat.",
        });
    }
    if (s.ingestAlive && s.hlsAgeMs != null && s.hlsAgeMs > 8000) {
        out.push({
            type: "hls_delay",
            severity: "warning",
            title: "HLS szegmens késik",
            message: `A playlist ${Math.round(s.hlsAgeMs / 1000)} másodperce nem frissült.`,
            recommendation: "Nézd meg, kap-e jelet az ingest. Ha igen, indítsd újra az FFmpeg adást.",
        });
    }
    if (s.fps != null && s.fps > 0 && s.fps < 18) {
        out.push({
            type: "low_fps",
            severity: "warning",
            title: "Alacsony FPS",
            message: `A kimeneti FPS jelenleg ${s.fps.toFixed(1)}.`,
            recommendation: "Csökkentsd a kimeneti felbontást 720p30-ra, vagy zárd be a felesleges encoder preseteket.",
        });
    }
    if (s.dropped != null && s.dropped > 30) {
        out.push({
            type: "dropped_frames",
            severity: "warning",
            title: "Eldobott képkockák",
            message: `Az FFmpeg ${s.dropped} drop frame-et jelzett.`,
            recommendation: "Csökkentsd a bitrate-et 6000-ről 3500 kbps-re a stabilitásért, főleg mobilon.",
        });
    }
    if (s.bitrateKbps != null && s.bitrateKbps > 5500) {
        out.push({
            type: "high_bitrate",
            severity: "info",
            title: "Magas bitrate",
            message: `Jelenlegi videó bitrate ~${Math.round(s.bitrateKbps)} kbps.`,
            recommendation: "Csökkentsd 3500 kbps-re, hogy a mobilhálózatos nézők is stabilan kapják a jelet.",
        });
    }
    if (s.speed != null && s.speed < 0.85) {
        out.push({
            type: "encoder_overload",
            severity: "critical",
            title: "Encoder túlterhelés",
            message: `Az FFmpeg speed=${s.speed.toFixed(2)}x, lemarad a valós időtől.`,
            recommendation: "Használj veryfast/720p profilt, és ne indíts archív transzkódot élő adás alatt.",
        });
    }
    if (s.viewersAgo5m != null && s.viewersAgo5m >= 8) {
        const ratio = s.viewers / Math.max(1, s.viewersAgo5m);
        if (ratio >= 1.5) {
            out.push({
                type: "viewer_spike",
                severity: "info",
                title: "Nézőszám ugrás",
                message: `5 perc alatt ${s.viewersAgo5m} → ${s.viewers} néző (+${Math.round((ratio - 1) * 100)}%).`,
                recommendation: "A növekedés extra originkapacitást igényelhet. Kerüld a backupot és az archív generate-et most.",
            });
        }
        if (ratio <= 0.7) {
            out.push({
                type: "viewer_drop",
                severity: "warning",
                title: "Nézőszám esés",
                message: `5 perc alatt ${s.viewersAgo5m} → ${s.viewers} néző (−${Math.round((1 - ratio) * 100)}%).`,
                recommendation: "Indíts Q&A-t vagy említsd a chaten, mi következik — nézd a kapcsolat minőségét is.",
            });
        }
    }
    if (s.chatLastMin >= 12 && s.chatLastMin >= s.chatPrevMin * 2 + 4) {
        out.push({
            type: "chat_spike",
            severity: "info",
            title: "Szokatlanul élénk chat",
            message: `Az utóbbi percben ${s.chatLastMin} üzenet érkezett.`,
            recommendation: "Olvasd a kérdéseket, vagy emeld ki a moderált aktuális kérdést a képernyőn.",
        });
    }
    if (s.duplicateQuestions >= 3 && s.topQuestion) {
        out.push({
            type: "top_question",
            severity: "info",
            title: "Többen ugyanazt kérdezik",
            message: `Ismétlődő kérdés: „${s.topQuestion.slice(0, 140)}”`,
            recommendation: "Válaszold meg élőben, és tedd aktuális kérdéssé a moderációban.",
        });
    }
    if (s.ticketsLast5m >= 3 && s.ticketsLast5m >= Math.max(2, s.ticketsPrev5m) * 2) {
        out.push({
            type: "ticket_spike",
            severity: "info",
            title: "Jegyeladási ugrás",
            message: `5 perc alatt ${s.ticketsLast5m} új jegy, az előző ablak ${s.ticketsPrev5m} volt.`,
            recommendation: "Említsd a chatben a jegypakkot / Q&A lehetőséget, amíg tart az érdeklődés.",
        });
    }
    if (s.cpuPct >= 90) {
        out.push({
            type: "cpu_high",
            severity: "critical",
            title: "CPU 90% felett",
            message: `A szerver CPU terhelése ~${Math.round(s.cpuPct)}%.`,
            recommendation: "Ne indíts backupot vagy archív encode-ot. Csökkentsd az OBS bitrate-et.",
        });
    } else if (s.cpuPct >= 80) {
        out.push({
            type: "cpu_high",
            severity: "warning",
            title: "CPU 80% felett",
            message: `A szerver CPU terhelése ~${Math.round(s.cpuPct)}%.`,
            recommendation: "Szabadíts magot: zárd a párhuzamos transzkódot, maradjon az egy encode.",
        });
    }
    if (s.ramPct >= 85) {
        out.push({
            type: "ram_high",
            severity: "critical",
            title: "RAM 85% felett",
            message: `Memóriahasználat ~${Math.round(s.ramPct)}%.`,
            recommendation: "A PM2 1024M API limit előtt szabadíts memóriát, különben az ingest restartol.",
        });
    }
    if (s.dbLatencyMs >= 400) {
        out.push({
            type: "latency_high",
            severity: "warning",
            title: "Lassú szerver-válasz",
            message: `Az adatbázis ping ${Math.round(s.dbLatencyMs)} ms.`,
            recommendation: "Ne indíts nagy backupot élő alatt; ellenőrizd a lemez I/O-t.",
        });
    }

    const window = trend.filter((p) => now - p.t <= 10 * 60_000);
    if (window.length >= 8) {
        const slope = linearSlope(window.map((p) => [p.t, p.cpu] as [number, number]));
        const lastCpu = window[window.length - 1].cpu;
        if (slope > 0.004 && lastCpu >= 65 && lastCpu < 90) {
            out.push({
                type: "cpu_trend",
                severity: "warning",
                title: "CPU folyamatosan emelkedik",
                message: "Az utóbbi 10 percben a CPU trendje emelkedő, hamarosan kritikus lehet.",
                recommendation: "Csökkentsd a bitrate-et most, és ne indíts második FFmpeg folyamatot.",
            });
        }
        const vSlope = linearSlope(window.map((p) => [p.t, p.viewers] as [number, number]));
        if (vSlope > 0.002 && s.viewers >= 20) {
            out.push({
                type: "capacity_trend",
                severity: "info",
                title: "Nézőszám-trend: kapacitás",
                message: "A nézőszám emelkedő trendje extra originkapacitást jelez.",
                recommendation: "Kerüld a backupot és a dual-encode-ot; a P0 720p cap maradjon bekapcsolva.",
            });
        }
    }
    return out;
}

function linearSlope(points: [number, number][]) {
    const n = points.length;
    if (n < 2) return 0;
    const t0 = points[0][0];
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    for (const [t, y] of points) {
        const x = (t - t0) / 1000;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
    }
    const den = n * sumXX - sumX * sumX;
    if (!den) return 0;
    return (n * sumXY - sumX * sumY) / den;
}
