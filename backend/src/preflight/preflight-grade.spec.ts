import { gradePreflight } from "./preflight-grade";

const okBase = {
    cameraOk: true,
    micOk: true,
    networkOk: true,
    ingestOk: true,
    videoPackets: true,
    audioPackets: true,
};

describe("gradePreflight", () => {
    it("marks excellent on strong uplink", () => {
        const r = gradePreflight({
            ...okBase,
            pingMs: 40,
            jitterMs: 8,
            lossPct: 0,
            uploadMbps: 8,
        });
        expect(r.grade).toBe("excellent");
        expect(r.recommended.height).toBe(1080);
        expect(r.liveOk).toBe(true);
    });

    it("marks critical when camera fails", () => {
        const r = gradePreflight({
            ...okBase,
            cameraOk: false,
            pingMs: 40,
            jitterMs: 8,
            lossPct: 0,
            uploadMbps: 8,
        });
        expect(r.grade).toBe("critical");
        expect(r.liveOk).toBe(false);
    });

    it("marks weak on mediocre uplink", () => {
        const r = gradePreflight({
            ...okBase,
            pingMs: 180,
            jitterMs: 35,
            lossPct: 4,
            uploadMbps: 2.2,
        });
        expect(r.grade).toBe("weak");
        expect(r.recommended.bitrate).toBe("low");
    });
});
