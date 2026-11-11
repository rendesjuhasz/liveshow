import { BadRequestException } from "@nestjs/common";

export const OFF_PLATFORM_CONTACT_MESSAGE =
    "Személyes elérhetőséget (e-mail, telefonszám) vagy külső kapcsolatfelvételt (Messenger, Telegram, WhatsApp, Instagram, Facebook stb.) nem lehet megosztani. A beszélgetés maradjon a platformon.";

function fold(text: string) {
    return String(text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function normalizeForScan(text: string) {
    let n = fold(text)
        .replace(/\[(?:at|kukac)\]|\((?:at|kukac)\)|\s+(?:at|kukac)\s+/g, "@")
        .replace(/\[(?:dot|pont)\]|\((?:dot|pont)\)|\s+(?:dot|pont)\s+/g, ".")
        .replace(/\s+/g, " ")
        .trim();
    if (n.includes("@")) {
        n = n.replace(/[(\[]([a-z]{2,})[)\]]/g, "$1");
    }
    return n;
}

const EMAIL_RE = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i;
const OBFUSCATED_EMAIL_RE =
    /[a-z0-9._%+\-]{2,}\s*(?:@|\[at\]|\(at\)|kukac)\s*[a-z0-9.\-]{2,}\s*(?:\.|\[dot\]|\(dot\)|pont)\s*[a-z]{2,}/i;

const URL_RE =
    /(https?:\/\/|www\.|bit\.ly\/|tinyurl\.|t\.me\/|discord(?:\.gg|app\.com)\/|wa\.me\/|chat\.whatsapp|instagram\.com|facebook\.com|fb\.com|messenger\.com|tiktok\.com|snapchat\.com|signal\.me)/i;

const HANDLE_RE =
    /(?:telegram|whatsapp|viber|signal|discord|instagram|\binsta\b|facebook|messenger|snapchat|skype)\s*[:.@/]/i;

const PHRASE_RE =
    /(hivj\s*fel|hivd\s*fel|irj\s*(?:ra|ide|emailt|mailt)|email\s*cimem|e-mail\s*cimem|telefonszam(?:om|od)?|add\s*meg\s*a\s*(?:szamod|mailed)|privatban\s*irj)/i;

const HU_PHONE_RE = /(?:\+36|0036|06)[\s./-]?(?:1|[2-9]\d)[\s./-]?\d{3}[\s./-]?\d{3,4}/;
const INTL_PLUS_RE = /\+[1-9]\d{6,14}\b/;
const MOBILE_GROUPS_RE = /(?:^|[^\d])(?:20|30|31|50|70)[\s./-]\d{3}[\s./-]\d{3,4}(?:[^\d]|$)/;

export function findOffPlatformContact(text: string): string | null {
    const raw = String(text || "");
    if (!raw.trim()) return null;
    const n = normalizeForScan(raw);
    if (EMAIL_RE.test(raw) || EMAIL_RE.test(n) || OBFUSCATED_EMAIL_RE.test(raw) || OBFUSCATED_EMAIL_RE.test(n)) {
        return "email";
    }
    if (URL_RE.test(raw) || URL_RE.test(n)) return "url";
    if (HANDLE_RE.test(n) || PHRASE_RE.test(n)) return "channel";
    const compact = n.replace(/[\s()./-]/g, "");
    if (HU_PHONE_RE.test(n) || HU_PHONE_RE.test(compact)) return "phone";
    if (INTL_PLUS_RE.test(raw) || INTL_PLUS_RE.test(n) || INTL_PLUS_RE.test(compact.replace(/^00/, "+"))) {
        return "phone";
    }
    if (MOBILE_GROUPS_RE.test(n)) return "phone";
    return null;
}

export function assertNoOffPlatformContact(...parts: Array<string | null | undefined>) {
    for (const part of parts) {
        if (findOffPlatformContact(part || "")) {
            throw new BadRequestException(OFF_PLATFORM_CONTACT_MESSAGE);
        }
    }
}
