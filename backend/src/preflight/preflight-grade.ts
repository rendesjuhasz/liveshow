export const PREFLIGHT_GRADES = ["excellent", "good", "weak", "critical"] as const;
export type PreflightGrade = (typeof PREFLIGHT_GRADES)[number];

export type PreflightMetrics = {
    cameraOk: boolean;
    micOk: boolean;
    networkOk: boolean;
    ingestOk: boolean;
    pingMs: number | null;
    jitterMs: number | null;
    lossPct: number | null;
    uploadMbps: number | null;
    videoPackets: boolean;
    audioPackets: boolean;
};

export type PreflightAdvice = {
    grade: PreflightGrade;
    liveOk: boolean;
    recommended: {
        label: string;
        height: number;
        fps: number;
        bitrate: "normal" | "low";
    };
    warning: string | null;
};

export function isPreflightGrade(value: string): value is PreflightGrade {
    return (PREFLIGHT_GRADES as readonly string[]).includes(value);
}

export function gradePreflight(m: PreflightMetrics): PreflightAdvice {
    const ping = m.pingMs;
    const jitter = m.jitterMs;
    const loss = m.lossPct;
    const up = m.uploadMbps;
    const mediaFail = !m.cameraOk || !m.micOk;
    const ingestFail = !m.ingestOk || !m.videoPackets || !m.audioPackets;
    const netFail =
        !m.networkOk ||
        ping == null ||
        jitter == null ||
        loss == null ||
        up == null ||
        ping > 400 ||
        jitter > 80 ||
        loss > 12 ||
        up < 1.5;

    if (mediaFail || ingestFail || netFail) {
        return {
            grade: "critical",
            liveOk: false,
            recommended: { label: "720p / 30 FPS (alacsony bitrate)", height: 720, fps: 30, bitrate: "low" },
            warning: "Kritikus: az élő indítás nem ajánlott, amíg a hibás pontot nem javítod.",
        };
    }

    if (up >= 6 && ping <= 80 && jitter <= 20 && loss <= 1) {
        return {
            grade: "excellent",
            liveOk: true,
            recommended: { label: "1080p / 30 FPS", height: 1080, fps: 30, bitrate: "normal" },
            warning: null,
        };
    }

    if (up >= 3 && ping <= 150 && jitter <= 40 && loss <= 3) {
        return {
            grade: "good",
            liveOk: true,
            recommended: { label: "720p / 30 FPS", height: 720, fps: 30, bitrate: "normal" },
            warning: null,
        };
    }

    return {
        grade: "weak",
        liveOk: true,
        recommended: { label: "720p / 30 FPS (alacsony bitrate)", height: 720, fps: 30, bitrate: "low" },
        warning: "Gyenge kapcsolat: csökkentsd a bitrate-et, és maradj Wi‑Fin.",
    };
}

export function gradeToLinkQuality(grade: PreflightGrade): "good" | "fair" | "poor" | "critical" {
    if (grade === "excellent") return "good";
    if (grade === "good") return "fair";
    if (grade === "weak") return "poor";
    return "critical";
}
