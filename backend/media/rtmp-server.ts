import NodeMediaServer from "node-media-server";

const config = {
    logType: 2,

    rtmp: {
        port: 1935,
        chunk_size: 60000,
        gop_cache: true,
        ping: 30,
        ping_timeout: 60,
    },

    http: {
        port: 8080,
        allow_origin: "*",
    },

    trans: {
        ffmpeg: "ffmpeg",
        tasks: [],
    },
};

const nms = new NodeMediaServer(config);
nms.run();
