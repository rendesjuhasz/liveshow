import { BadRequestException, HttpException, HttpStatus } from "@nestjs/common";

const hits = new Map<string, number[]>();

export function assertRateLimit(key: string, max: number, windowMs: number) {
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
        throw new HttpException("Túl sok kérés. Próbáld újra később.", HttpStatus.TOO_MANY_REQUESTS);
    }
    recent.push(now);
    hits.set(key, recent);
}

export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function assertValidEmail(email: string) {
    if (!EMAIL_RE.test(email) || email.length > 190) {
        throw new BadRequestException("Érvényes email cím szükséges.");
    }
}

export function assertValidPassword(password: string) {
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
        throw new BadRequestException(`A jelszó legalább ${MIN_PASSWORD_LENGTH} karakter legyen.`);
    }
}

export function clientKey(req: { ip?: string; headers?: Record<string, unknown>; socket?: { remoteAddress?: string } }) {
    const xf = req.headers?.["x-forwarded-for"];
    const forwarded = Array.isArray(xf) ? xf[0] : String(xf || "");
    return (forwarded.split(",")[0] || req.ip || req.socket?.remoteAddress || "unknown").trim();
}
