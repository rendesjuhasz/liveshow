"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTranscoderJob = runTranscoderJob;
const ffmpeg_pipeline_1 = require("./ffmpeg-pipeline");
async function runTranscoderJob(job) {
    console.log("Transcoder worker: job received:", job);
    try {
        await (0, ffmpeg_pipeline_1.createHlsPipeline)(job.input, job.output);
        console.log("Transcoder worker: job finished");
        return { success: true };
    }
    catch (err) {
        console.error("Transcoder worker: job failed", err);
        return { success: false, error: err };
    }
}
