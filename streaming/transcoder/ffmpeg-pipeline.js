"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHlsPipeline = createHlsPipeline;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
function createHlsPipeline(inputPath, outputDir) {
    return new Promise((resolve, reject) => {
        if (!fs_1.default.existsSync(outputDir)) {
            fs_1.default.mkdirSync(outputDir, { recursive: true });
        }
        const args = [
            "-i", inputPath,
            "-codec:", "copy",
            "-start_number", "0",
            "-hls_time", "4",
            "-hls_list_size", "0",
            "-f", "hls",
            path_1.default.join(outputDir, "index.m3u8")
        ];
        const ffmpeg = (0, child_process_1.spawn)("ffmpeg", args);
        ffmpeg.stderr.on("data", (data) => {
            console.log("FFmpeg:", data.toString());
        });
        ffmpeg.on("close", (code) => {
            if (code === 0)
                resolve(true);
            else
                reject(new Error("FFmpeg pipeline failed"));
        });
    });
}
