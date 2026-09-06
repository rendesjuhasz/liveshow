import { Injectable } from "@nestjs/common";
import { spawn } from "child_process";
import {
    ensureStreamOutputDir,
    getHlsPlaylistFile,
    getHlsPublicPath,
} from "./hls-paths";

@Injectable()
export class StreamingService {
    startLiveStream(streamId: string) {
        ensureStreamOutputDir(streamId);
        const liveOutput = getHlsPlaylistFile(streamId);

        const ffmpeg = spawn("ffmpeg", [
            "-i",
            "rtp://localhost:5004",
            "-codec:v",
            "libx264",
            "-codec:a",
            "aac",
            "-f",
            "hls",
            "-hls_time",
            "4",
            "-hls_list_size",
            "5",
            liveOutput,
        ]);

        ffmpeg.stdout.on("data", (data) => console.log(data.toString()));
        ffmpeg.stderr.on("data", (data) => console.log(data.toString()));

        return {
            ffmpeg,
            streamId,
            hls: getHlsPublicPath(streamId),
            file: liveOutput,
        };
    }
}
