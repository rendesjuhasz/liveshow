"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

export default function Player({ streamId }: { streamId: string }) {
    console.log("PLAYER FUT!");
    console.log("STREAM ID:", streamId);

    const videoRef = useRef<HTMLVideoElement>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const streamUrl = `http://localhost:3200/output/test123/index.m3u8`;
        console.log("STREAM URL:", streamUrl);

        if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(streamUrl);
            hls.attachMedia(videoRef.current!);
        } else {
            videoRef.current!.src = streamUrl;
        }

        setLoading(false);
    }, [streamId]);

    return (
        <div>
            {loading && <p>Betöltés…</p>}
            <video ref={videoRef} controls autoPlay style={{ width: "100%" }} />
        </div>
    );
}
