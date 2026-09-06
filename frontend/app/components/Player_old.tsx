"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";

export default function Player({ src }: { src: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (!videoRef.current) return;

        // Ha a böngésző támogatja a HLS-t natívan (Safari)
        if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
            videoRef.current.src = src;
            return;
        }

        // Ha nem támogatja → HLS.js kell
        if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(src);
            hls.attachMedia(videoRef.current);

            return () => {
                hls.destroy();
            };
        }
    }, [src]);

    return (
        <div style={{ width: "100%", maxWidth: 800, margin: "0 auto" }}>
            <video
                ref={videoRef}
                controls
                style={{ width: "100%", backgroundColor: "#000" }}
            />
        </div>
    );
}
