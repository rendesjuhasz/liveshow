import { createHlsPipeline } from "./ffmpeg-pipeline";

export async function runTranscoderJob(job: { input: string; output: string }) {
    console.log("Transcoder worker: job received:", job);

    try {
        await createHlsPipeline(job.input, job.output);
        console.log("Transcoder worker: job finished");
        return { success: true };
    } catch (err) {
        console.error("Transcoder worker: job failed", err);
        return { success: false, error: err };
    }
}
