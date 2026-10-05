export function sanitizeUserText(input: unknown, max = 4000) {
    return String(input ?? "")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
        .replace(/<[^>]*>/g, "")
        .replace(/javascript:/gi, "")
        .slice(0, max)
        .trim();
}
