import { ConflictException, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import * as net from "net";
import { IngestService } from "./ingest.service";
import { rtmpAppName, rtmpListenPort } from "./ingest-ffmpeg";
import { sanitizeStreamId } from "../streaming/hls-paths";

type RtmpSession = {
    streamApp?: string;
    streamName?: string;
};

function portBusy(port: number, host: string) {
    return new Promise<boolean>((resolve) => {
        const probe = net.createServer();
        probe.once("error", (err: NodeJS.ErrnoException) => {
            resolve(err.code === "EADDRINUSE");
        });
        probe.once("listening", () => {
            probe.close(() => resolve(false));
        });
        probe.listen(port, host);
    });
}

@Injectable()
export class RtmpIngestService implements OnModuleInit {
    private readonly log = new Logger(RtmpIngestService.name);

    constructor(private readonly ingest: IngestService) {}

    async onModuleInit() {
        if (process.env.RTMP_DISABLED === "1") {
            this.log.log("RTMP ingest kikapcsolva (RTMP_DISABLED=1). Élő adás: WebRTC.");
            return;
        }
        const port = rtmpListenPort();
        if (await portBusy(port, "127.0.0.1")) {
            this.log.warn(
                `RTMP kihagyva: 127.0.0.1:${port} már foglalt (másik backend példány). Az API továbbfut; az élő adás WebRTC-vel megy.`,
            );
            return;
        }
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const NodeMediaServer = require("node-media-server");
        const nms = new NodeMediaServer({
            bind: "127.0.0.1",
            rtmp: { port },
            auth: { play: false, publish: false },
        });
        const tcp = nms.rtmpServer?.tcpServer as net.Server | undefined;
        tcp?.on("error", (err: NodeJS.ErrnoException) => {
            if (err.code === "EADDRINUSE") {
                this.log.warn(
                    `RTMP ${port} foglalt. Az API továbbfut; az élő adás WebRTC-vel megy.`,
                );
                return;
            }
            this.log.warn(`RTMP hiba: ${err.message}`);
        });
        nms.on("postPublish", (session: RtmpSession) => {
            const streamId = this.streamIdOf(session);
            if (!streamId) return;
            void this.ingest.startIngest(streamId).catch((err: unknown) => {
                if (err instanceof ConflictException) return;
                this.log.warn(`RTMP ingest nem indult (${streamId}): ${err instanceof Error ? err.message : err}`);
            });
        });
        nms.on("donePublish", (session: RtmpSession) => {
            const streamId = this.streamIdOf(session);
            if (!streamId) return;
            void this.ingest.stopIngest(streamId).catch(() => undefined);
        });
        nms.run();
        this.log.log(`RTMP ingest listening on rtmp://127.0.0.1:${port}/${rtmpAppName()}/<streamId>`);
    }

    private streamIdOf(session: RtmpSession) {
        if (String(session?.streamApp || "") !== rtmpAppName()) return "";
        return sanitizeStreamId(String(session?.streamName || "").trim());
    }
}
