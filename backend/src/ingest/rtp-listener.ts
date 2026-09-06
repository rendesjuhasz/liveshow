import * as dgram from 'dgram';
import * as fs from 'fs';

export class RtpListener {
    private server = dgram.createSocket('udp4');
    private fileStream!: fs.WriteStream;   // ← EZ A JAVÍTÁS

    constructor(private port: number, private outputPath: string) { }

    start() {
        this.fileStream = fs.createWriteStream(this.outputPath);

        this.server.on('message', (msg) => {
            this.fileStream.write(msg);
        });

        this.server.bind(this.port, () => {
            console.log(`RTP listener running on port ${this.port}`);
        });
    }

    stop() {
        this.server.close();
        this.fileStream.close();
    }
}
