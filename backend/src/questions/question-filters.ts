import { findOffPlatformContact, OFF_PLATFORM_CONTACT_MESSAGE } from "../security/contact-leak";

const DEFAULT_BANNED = [
    "kurva",
    "fasz",
    "faszfej",
    "buzi",
    "geci",
    "picsa",
    "köcsög",
    "kocsog",
    "anyad",
    "anyád",
    "piszka",
    "nigger",
    "retard",
    "hülye",
    "hulye",
    "idiot",
    "viagra",
    "onlyfans",
    "crypto giveaway",
    "ingyen bitcoin",
    "free nitro",
    "airdrop",
    "csaladbarat cam",
];

const URL_RE = /(https?:\/\/|www\.|bit\.ly\/|t\.me\/|discord\.gg\/)/i;
const REPEAT_RE = /(.)\1{6,}/;
const REPEAT_WORD_RE = /(\b\w{2,}\b)(?:\s+\1){4,}/i;

export const MAX_ASKERS = 10;
export const FLOOD_MS = 5_000;
export const MAX_PENDING_PER_USER = 2;
export const MIN_QUESTION_LEN = 8;
export const MAX_QUESTION_LEN = 400;
export const MIN_CHAT_LEN = 1;
export const MAX_CHAT_LEN = 280;
export const CHAT_FLOOD_MS = 3_000;

export function normalizeQuestionText(text: string) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

export function foldWord(word: string) {
    return word
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

export function collectBannedWords(fromDb: string[]) {
    const set = new Set<string>();
    for (const w of [...DEFAULT_BANNED, ...fromDb]) {
        const folded = foldWord(w);
        if (folded) set.add(folded);
    }
    return [...set];
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findBannedWord(text: string, words: string[]) {
    const folded = foldWord(text);
    for (const word of words) {
        if (!word || word.length < 3) continue;
        const re = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(word)}(?:$|[^a-z0-9])`, "i");
        if (re.test(folded)) return word;
    }
    return null;
}

export function spamReason(text: string): string | null {
    const trimmed = text.trim();
    if (trimmed.length < MIN_QUESTION_LEN) {
        return "A kérdés túl rövid.";
    }
    if (trimmed.length > MAX_QUESTION_LEN) {
        return "A kérdés túl hosszú.";
    }
    if (findOffPlatformContact(trimmed) || URL_RE.test(trimmed)) {
        return findOffPlatformContact(trimmed)
            ? OFF_PLATFORM_CONTACT_MESSAGE
            : "Linket nem lehet kérdésbe írni.";
    }
    if (REPEAT_RE.test(trimmed) || REPEAT_WORD_RE.test(trimmed)) {
        return "Ismétlődő, spamszerű szöveg.";
    }
    const letters = trimmed.replace(/[^A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]/g, "");
    if (letters.length >= 16 && letters === letters.toUpperCase()) {
        return "Csak nagybetűs szöveg nem engedélyezett.";
    }
    const unique = new Set(normalizeQuestionText(trimmed).split(" "));
    if (unique.size <= 2 && trimmed.split(/\s+/).length >= 8) {
        return "Spamszerű, ismételt szavak.";
    }
    return null;
}

export function chatSpamReason(text: string): string | null {
    const trimmed = text.trim();
    if (trimmed.length < MIN_CHAT_LEN) {
        return "Üres üzenet.";
    }
    if (trimmed.length > MAX_CHAT_LEN) {
        return "Az üzenet túl hosszú.";
    }
    if (findOffPlatformContact(trimmed) || URL_RE.test(trimmed)) {
        return findOffPlatformContact(trimmed)
            ? OFF_PLATFORM_CONTACT_MESSAGE
            : "Linket nem lehet chatbe írni.";
    }
    if (REPEAT_RE.test(trimmed) || REPEAT_WORD_RE.test(trimmed)) {
        return "Ismétlődő, spamszerű szöveg.";
    }
    const letters = trimmed.replace(/[^A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]/g, "");
    if (letters.length >= 16 && letters === letters.toUpperCase()) {
        return "Csak nagybetűs szöveg nem engedélyezett.";
    }
    return null;
}
