import { runTranscoderJob } from "./worker";

runTranscoderJob({
    input: "input.mp4",
    output: "output/hls"
});
