// streaming/transcoder/ffmpeg-runner.ts

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

export class FFmpegRunner {
    run(args: string[]): ChildProcessWithoutNullStreams {
        console.log('FFmpeg args:', args.join(' '));

        const ffmpeg = spawn('ffmpeg', args);

        ffmpeg.stderr.on('data', data => {
            console.log('[ffmpeg]', data.toString());
        });

        ffmpeg.on('close', code => {
            console.log('[ffmpeg] finished with code', code);
        });

        return ffmpeg;
    }
}
