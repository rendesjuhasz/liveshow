import type { Metadata } from "next";
import { DEFAULT_LOCALE } from "./i18n/messages";
import { metadataForPath } from "./seo";

/** Cookie nélkül — jogi / statikus oldalak ISR-hez. */
export function staticRouteMetadata(path: string): Promise<Metadata> {
    return metadataForPath(path, DEFAULT_LOCALE);
}

export async function routeMetadata(path: string): Promise<Metadata> {
    return staticRouteMetadata(path);
}

export function paramId(value: string | string[] | undefined) {
    return decodeURIComponent(String(Array.isArray(value) ? value[0] : value || "").trim());
}
