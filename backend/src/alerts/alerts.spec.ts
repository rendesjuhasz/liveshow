import { parseFfmpegProgress } from "./ffmpeg-progress";
import { evaluateAlerts } from "./alert-rules";

describe("AI Safety Alerts engine", () => {
    it("parses ffmpeg progress", () => {
        const p = parseFfmpegProgress("frame= 10 fps= 12.5 bitrate= 6200.0kbits/s drop= 40 speed=0.70x");
        expect(p.fps).toBe(12.5);
        expect(p.bitrateKbps).toBe(6200);
        expect(p.dropped).toBe(40);
        expect(p.speed).toBe(0.7);
    });

    it("detects viewer drop and cpu trend", () => {
        const now = Date.now();
        const trend = Array.from({ length: 12 }, (_, i) => ({
            t: now - (11 - i) * 50_000,
            cpu: 50 + i * 3,
            viewers: 10 + i * 2,
        }));
        const drafts = evaluateAlerts(
            {
                showId: "s",
                streamId: "s",
                ingestAlive: true,
                showLive: true,
                viewers: 10,
                viewersAgo5m: 20,
                chatLastMin: 1,
                chatPrevMin: 1,
                ticketsLast5m: 0,
                ticketsPrev5m: 0,
                duplicateQuestions: 0,
                cpuPct: 82,
                ramPct: 40,
                dbLatencyMs: 20,
            },
            trend,
        );
        expect(drafts.some((d) => d.type === "viewer_drop")).toBe(true);
        expect(drafts.some((d) => d.type === "cpu_high")).toBe(true);
        expect(drafts.some((d) => d.recommendation.length > 10)).toBe(true);
    });
});
