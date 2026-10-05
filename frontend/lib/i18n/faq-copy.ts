import type { FaqItem } from "@/components/FaqList";

const CATEGORY_KEYS: Record<string, string> = {
    Jegyvásárlás: "faq.cat.tickets",
    Közvetítések: "faq.cat.streams",
    Fiókom: "faq.cat.account",
    Fizetés: "faq.cat.payment",
    Archívum: "faq.cat.archive",
};

const QUESTION_KEYS: Record<string, string> = {
    "Hogyan vásárolhatok jegyet?": "faq.1",
    "Sikeres volt a fizetés, de nem látom a hozzáférést.": "faq.2",
    "Visszakérhetem a jegy árát?": "faq.3",
    "Hol nézhetem meg az élő adást?": "faq.4",
    "Nem indul el a stream.": "faq.5",
    "Milyen böngészők támogatottak?": "faq.6",
    "Elfelejtettem a jelszavamat.": "faq.7",
    "Megváltoztathatom az email címemet?": "faq.8",
    "Hogyan törölhetem a fiókomat?": "faq.9",
    "Milyen fizetési módok érhetők el?": "faq.10",
    "Sikertelen a tranzakció.": "faq.11",
    "Kétszer terheltek meg.": "faq.12",
    "Meddig nézhető vissza a felvétel?": "faq.13",
    "Hol találom az archív videókat?": "faq.14",
};

export function localizeFaqItem(item: FaqItem, t: (key: string) => string): FaqItem {
    const qKey = QUESTION_KEYS[item.question];
    const catKey = CATEGORY_KEYS[item.category];
    return {
        ...item,
        category: catKey ? t(catKey) : item.category,
        question: qKey ? t(`${qKey}.q`) : item.question,
        answer: qKey ? t(`${qKey}.a`) : item.answer,
    };
}
