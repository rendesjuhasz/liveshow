/** In-process node-media-server froze production /health. Off in production unless explicitly enabled. */
export function rtmpIngestEnabled() {
    const raw = String(process.env.RTMP_DISABLED ?? "").trim().toLowerCase();
    if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") return false;
    if (raw === "0" || raw === "false" || raw === "no" || raw === "off") return true;
    return process.env.NODE_ENV !== "production";
}
