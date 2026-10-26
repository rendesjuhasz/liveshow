"use client";

import { useEffect, useState } from "react";

const KEY = "liveshow.streamer.supportSound";

export function isSupportSoundOn() {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(KEY) !== "0";
}

export function setSupportSoundOn(on: boolean) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(KEY, on ? "1" : "0");
    window.dispatchEvent(new Event("liveshow-support-sound"));
}

export function useSupportSoundPref() {
    const [on, setOn] = useState(true);
    useEffect(() => {
        setOn(isSupportSoundOn());
        const sync = () => setOn(isSupportSoundOn());
        window.addEventListener("storage", sync);
        window.addEventListener("liveshow-support-sound", sync);
        return () => {
            window.removeEventListener("storage", sync);
            window.removeEventListener("liveshow-support-sound", sync);
        };
    }, []);
    return {
        on,
        setOn: (next: boolean) => {
            setSupportSoundOn(next);
            setOn(next);
        },
    } as const;
}
