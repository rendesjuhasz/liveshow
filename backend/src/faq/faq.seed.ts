export const FAQ_CATEGORIES = [
    "Jegyvásárlás",
    "Közvetítések",
    "Fiókom",
    "Fizetés",
    "Archívum",
] as const;

export const DEFAULT_FAQS: {
    category: string;
    question: string;
    answer: string;
    order: number;
}[] = [
    {
        category: "Jegyvásárlás",
        question: "Hogyan vásárolhatok jegyet?",
        answer: "A kívánt eseménynél a Jegyvásárlás gombra kattintva.",
        order: 1,
    },
    {
        category: "Jegyvásárlás",
        question: "Sikeres volt a fizetés, de nem látom a hozzáférést.",
        answer: "A vásárlást követően frissítsd az oldalt vagy jelentkezz be újra.",
        order: 2,
    },
    {
        category: "Jegyvásárlás",
        question: "Visszakérhetem a jegy árát?",
        answer: "Az adott esemény szervezőjének szabályzata szerint.",
        order: 3,
    },
    {
        category: "Közvetítések",
        question: "Hol nézhetem meg az élő adást?",
        answer: "Az Élő menüpontban vagy a műsor oldalán. A megtekintés ingyenes; jegy csak a kérdésbeküldéshez és a prémium interakciókhoz kell.",
        order: 4,
    },
    {
        category: "Közvetítések",
        question: "Nem indul el a stream.",
        answer: "Ellenőrizd: internetkapcsolat, bejelentkezés, támogatott böngésző. Jegy az élő és archív nézéshez nem kell.",
        order: 5,
    },
    {
        category: "Közvetítések",
        question: "Milyen böngészők támogatottak?",
        answer: "Chrome, Edge, Firefox, Safari.",
        order: 6,
    },
    {
        category: "Fiókom",
        question: "Elfelejtettem a jelszavamat.",
        answer: 'Használd az "Elfelejtett jelszó" funkciót.',
        order: 7,
    },
    {
        category: "Fiókom",
        question: "Megváltoztathatom az email címemet?",
        answer: "Igen, a profilbeállításoknál.",
        order: 8,
    },
    {
        category: "Fiókom",
        question: "Hogyan törölhetem a fiókomat?",
        answer: "Kapcsolatfelvétel az ügyfélszolgálattal.",
        order: 9,
    },
    {
        category: "Fizetés",
        question: "Milyen fizetési módok érhetők el?",
        answer: "A platformon elérhető online fizetési lehetőségek.",
        order: 10,
    },
    {
        category: "Fizetés",
        question: "Sikertelen a tranzakció.",
        answer: "Próbáld újra vagy használj másik fizetési módot.",
        order: 11,
    },
    {
        category: "Fizetés",
        question: "Kétszer terheltek meg.",
        answer: "Lépj kapcsolatba az ügyfélszolgálattal.",
        order: 12,
    },
    {
        category: "Archívum",
        question: "Meddig nézhető vissza a felvétel?",
        answer: "Ezt az esemény szervezője határozza meg.",
        order: 13,
    },
    {
        category: "Archívum",
        question: "Hol találom az archív videókat?",
        answer: "A Visszanézés menüpontban. A megtekintés ingyenes; jegy csak a kérdésbeküldéshez és a prémium interakciókhoz kell.",
        order: 14,
    },
];
