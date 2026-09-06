"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_media_server_1 = __importDefault(require("node-media-server"));
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
const nms = new node_media_server_1.default(config);
nms.run();
