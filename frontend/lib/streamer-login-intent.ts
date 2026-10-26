const STREAMER_LOGIN_INTENT = "liveshow_streamer_intent";

export function markStreamerLoginIntent() {
    try {
        sessionStorage.setItem(STREAMER_LOGIN_INTENT, "1");
    } catch {
        /* private mode */
    }
}

export function hasStreamerLoginIntent() {
    try {
        return sessionStorage.getItem(STREAMER_LOGIN_INTENT) === "1";
    } catch {
        return false;
    }
}

export function clearStreamerLoginIntent() {
    try {
        sessionStorage.removeItem(STREAMER_LOGIN_INTENT);
    } catch {
        /* ignore */
    }
}
