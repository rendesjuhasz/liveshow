// streaming/transcoder/ffmpeg-command-builder.ts

export type OutputConfig =
    | {
        type: 'hls';
        path: string;
    };

export class FFmpegCommandBuilder {
    private input!: string;
    private outputs: OutputConfig[] = [];

    setInput(path: string) {
        this.input = path;
        return this;
    }

    addHlsOutput(path: string) {
        this.outputs.push({
            type: 'hls',
            path,
        });
        return this;
    }

    build(): string[] {
        const args: string[] = [];

        // bemenet
        args.push('-i', this.input);

        // kimenetek
        this.outputs.forEach(o => {
            if (o.type === 'hls') {
                args.push(
                    '-f', 'hls',
                    '-hls_time', '4',
                    '-hls_playlist_type', 'vod',

                    // ⭐ JAVÍTOTT ÚTVONAL — csak output/hls
                    '-hls_segment_filename', `${o.path}/segment_%03d.ts`,

                    // ⭐ JAVÍTOTT ÚTVONAL — csak output/hls
                    `${o.path}/index.m3u8`,
                );
            }
        });

        return args;
    }
}
