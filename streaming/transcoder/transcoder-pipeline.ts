// streaming/transcoder/transcoder-pipeline.ts

import { FFmpegCommandBuilder } from './ffmpeg-command-builder';
import { FFmpegRunner } from './ffmpeg-runner';

export class TranscoderPipeline {
    constructor(
        private readonly builder: FFmpegCommandBuilder,
        private readonly runner: FFmpegRunner,
    ) { }

    async start(input: string) {
        // HELYES ÚTVONAL — a transcoder mappából nézve
        const hlsOutputPath = 'output/hls';

        const args = this.builder
            .setInput(input)
            .addHlsOutput(hlsOutputPath)
            .build();

        return this.runner.run(args);
    }
}

// Egyszerű indítási példa:
async function main() {
    const builder = new FFmpegCommandBuilder();
    const runner = new FFmpegRunner();
    const pipeline = new TranscoderPipeline(builder, runner);

    await pipeline.start('videos/input(3).mp4');
}

main().catch(err => {
    console.error('Transcoder error:', err);
});
