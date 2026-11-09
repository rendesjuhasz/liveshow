import { BadRequestException, ConflictException } from "@nestjs/common";

export const USERNAME_TAKEN_MESSAGE = "Ez a felhasználónév már létezik.";
export const USERNAME_REQUIRED_MESSAGE = "Előbb válassz felhasználónevet.";
export const USERNAME_IMMUTABLE_MESSAGE = "A felhasználónév nem módosítható.";

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

const RESERVED = new Set([
    "admin",
    "administrator",
    "api",
    "archive",
    "auth",
    "help",
    "live",
    "login",
    "me",
    "mod",
    "moderator",
    "profile",
    "register",
    "root",
    "streamer",
    "support",
    "system",
    "username",
    "www",
]);

export function normalizeUsername(raw?: string | null) {
    return String(raw || "")
        .trim()
        .toLowerCase();
}

export function assertValidUsername(raw?: string | null) {
    const username = normalizeUsername(raw);
    if (!username) {
        throw new BadRequestException("A felhasználónév kötelező.");
    }
    if (!USERNAME_RE.test(username)) {
        throw new BadRequestException(
            "A felhasználónév 3–24 karakter, csak angol kisbetű, szám és aláhúzás.",
        );
    }
    if (RESERVED.has(username)) {
        throw new BadRequestException(USERNAME_TAKEN_MESSAGE);
    }
    return username;
}

export function isUsernameConflict(err: unknown) {
    const meta = err && typeof err === "object" && "meta" in err ? (err as { meta?: { target?: unknown } }).meta : null;
    const target = meta?.target;
    const fields = Array.isArray(target) ? target.map((t) => String(t)) : [String(target || "")];
    if (fields.some((f) => f.toLowerCase().includes("username"))) return true;
    const message = err instanceof Error ? err.message : String(err || "");
    return /username/i.test(message) && /unique|duplicate/i.test(message);
}

export function throwUsernameConflict(err?: unknown): never {
    if (err && isUsernameConflict(err)) {
        throw new ConflictException(USERNAME_TAKEN_MESSAGE);
    }
    if (err) throw err;
    throw new ConflictException(USERNAME_TAKEN_MESSAGE);
}

export function publicUsername(
    user?: { username?: string | null } | string | null,
    fallback = "Néző",
) {
    if (typeof user === "string") {
        const value = user.trim();
        return value || fallback;
    }
    const value = String(user?.username || "").trim();
    return value || fallback;
}
