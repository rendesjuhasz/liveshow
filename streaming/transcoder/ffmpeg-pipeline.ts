import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export function createHlsPipeline(inputPath: string, outputDir: string) {
    return new Promise((resolve, reject) => {

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const args = [
            "-i", inputPath,
            "-codec:", "copy",
            "-start_number", "0",
            "-hls_time", "4",
            "-hls_list_size", "0",
            "-f", "hls",
            path.join(outputDir, "index.m3u8")
        ];

        const ffmpeg = spawn("ffmpeg", args);

        ffmpeg.stderr.on("data", (data) => {
            console.log("FFmpeg:", data.toString());
        });

        ffmpeg.on("close", (code) => {
            if (code === 0) resolve(true);
            else reject(new Error("FFmpeg pipeline failed"));
        });
    });
}
