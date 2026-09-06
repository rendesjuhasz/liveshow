"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const worker_1 = require("./worker");
(0, worker_1.runTranscoderJob)({
    input: "input.mp4",
    output: "output/hls"
});
