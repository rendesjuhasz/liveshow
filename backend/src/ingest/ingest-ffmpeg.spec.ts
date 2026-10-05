import { buildIngestFfmpegArgs, countLibx264, INGEST_THREADS, INGEST_VIDEO_BUFSIZE, INGEST_VIDEO_MAXRATE, teePath } from "./ingest-ffmpeg";

describe("buildIngestFfmpegArgs", () => {
    const args = buildIngestFfmpegArgs({
        streamId: "show1",
        playlistFile: "C:\\live\\show\\index.m3u8",
        recordingFile: "C:\\live\\show\\recording.mp4",
    });

    it("pulls RTMP from the local ingest app", () => {
        expect(args).toContain("-i");
        expect(args[args.indexOf("-i") + 1]).toBe("rtmp://127.0.0.1:1935/live/show1");
    });

    it("encodes video once", () => {
        expect(countLibx264(args)).toBe(1);
        expect(args).toContain("0:a:0?");
        expect(args).toContain("-f");
        expect(args[args.lastIndexOf("-f") + 1]).toBe("tee");
    });

    it("caps threads, 720p30, and bitrate", () => {
        expect(args).toContain("-threads");
        expect(args[args.indexOf("-threads") + 1]).toBe(INGEST_THREADS);
        expect(args.some((a) => a.includes("1280:720"))).toBe(true);
        expect(args.some((a) => a.includes("fps=30"))).toBe(true);
        expect(args).toContain("-x264-params");
        expect(args[args.indexOf("-x264-params") + 1]).toContain("threads=2");
        expect(args[args.indexOf("-maxrate") + 1]).toBe(INGEST_VIDEO_MAXRATE);
        expect(args[args.indexOf("-bufsize") + 1]).toBe(INGEST_VIDEO_BUFSIZE);
    });

    it("tees HLS sliding window and fragmented recording", () => {
        const tee = args[args.length - 1];
        expect(tee).toContain("hls_time=2");
        expect(tee).toContain("hls_list_size=6");
        expect(tee).toContain("delete_segments");
        expect(tee).toContain("frag_keyframe");
        expect(tee).toContain(teePath("C:\\live\\show\\index.m3u8"));
        expect(tee).toContain(teePath("C:\\live\\show\\recording.mp4"));
    });
});
