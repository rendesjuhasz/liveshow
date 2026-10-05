import { ForbiddenException } from "@nestjs/common";
import * as path from "path";

export function resolveInside(rootDir: string, candidate: string) {
    const root = path.resolve(rootDir);
    const resolved = path.resolve(candidate);
    const prefix = root.endsWith(path.sep) ? root : root + path.sep;
    if (resolved !== root && !resolved.startsWith(prefix)) {
        throw new ForbiddenException("Érvénytelen fájlútvonal.");
    }
    return resolved;
}
