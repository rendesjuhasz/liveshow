import { BadRequestException } from "@nestjs/common";

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertSafeId(id: string, label = "azonosító") {
    if (!UUID_RE.test(String(id || ""))) {
        throw new BadRequestException(`Érvénytelen ${label}.`);
    }
    return id;
}

export function assertSafeIds(ids: string[], label = "azonosító") {
    for (const id of ids) assertSafeId(id, label);
    return ids;
}
