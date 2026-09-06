export function jwtSecret() {
    const value = String(process.env.JWT_SECRET || "").trim();
    if (value) return value;
    if (process.env.NODE_ENV === "production") {
        throw new Error("JWT_SECRET kötelező éles környezetben.");
    }
    return "secret123";
}

export function corsOrigins() {
    const extra = String(process.env.FRONTEND_URL || "").trim().replace(/\/$/, "");
    const defaults = ["http://localhost:3000", "http://127.0.0.1:3000"];
    if (extra && !defaults.includes(extra)) {
        return [...defaults, extra];
    }
    if (extra) return defaults;
    return defaults;
}

export function isDevPayAllowed() {
    const flag = String(process.env.ALLOW_DEV_PAY || "").trim().toLowerCase();
    if (flag === "true" || flag === "1" || flag === "yes") return true;
    if (flag === "false" || flag === "0" || flag === "no") return false;
    return process.env.NODE_ENV !== "production";
}
