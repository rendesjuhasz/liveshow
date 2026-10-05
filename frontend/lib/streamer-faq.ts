export const STREAMER_HELP_TOPICS = [
    { id: "live", label: "Élő adás" },
    { id: "audio", label: "Hang" },
    { id: "video", label: "Kép" },
    { id: "payout", label: "Kifizetés" },
    { id: "moderation", label: "Moderálás" },
    { id: "other", label: "Egyéb" },
] as const;

export type StreamerFaqItem = {
    id: string;
    category: string;
    question: string;
    answer: string;
};

export const STREAMER_FAQ: StreamerFaqItem[] = [
    {
        id: "live-start",
        category: "Élő adás",
        question: "Hogyan indítsak élő adást?",
        answer:
            "Nyisd a Tartalomkészítő felületen az Élő adás menüt, válaszd ki a műsort, engedélyezd a kamerát és a mikrofont, majd indítsd az adást. Előtte érdemes az Adás előtt oldalon lefuttatni az eszközellenőrzést.",
    },
    {
        id: "live-camera",
        category: "Élő adás",
        question: "Hogyan állítsam be a kamerát?",
        answer:
            "Az élő stúdióban a böngésző bekéri a kameraengedélyt. Telefonomról a hátsó vagy elülső kamerát a stúdió gombjaival válthatod. Ha nincs kép, ellenőrizd, hogy más app nem foglalja-e a kamerát, majd frissítsd az oldalt.",
    },
    {
        id: "live-mic",
        category: "Élő adás",
        question: "Hogyan állítsam be a mikrofont?",
        answer:
            "Az élő stúdióban kapcsold be a mikrofont, és engedélyezd a hangot a böngészőben. A némítás gombbal kapcsolhatod ki. A hangot az Adás előtt oldalon is ellenőrizheted.",
    },
    {
        id: "live-net",
        category: "Élő adás",
        question: "Mit jelent a hálózati állapotjelző?",
        answer:
            "A stúdióban a kapcsolat minőségét jelzi (jó / gyenge / kritikus). Gyenge vagy piros állapotnál a nézőknél szakadozhat a kép. Stabil Wi‑Fi vagy 4G/5G kell; zárd be a felesleges letöltéseket.",
    },
    {
        id: "live-red",
        category: "Élő adás",
        question: "Mit jelent a piros figyelmeztetés?",
        answer:
            "Kritikus hiba: nagyon gyenge hálózat, kamera/mikrofon kiesés, vagy a szerver nem kap jelet. A Riasztások oldalon részletes ajánlást is látsz. Próbáld újraindítani az adást, vagy küldj hibabejelentést.",
    },
    {
        id: "av-no-audio",
        category: "Hang és kép",
        question: "Miért nincs hang a streamben?",
        answer:
            "Ellenőrizd, hogy a mikrofon nincs némítva, a böngésző hangengedélye be van kapcsolva, és a rendszer nem a rossz eszközt választotta. Nézőként a lejátszó gyakran némítva indul — a te adásodban a stúdió némítását nézd.",
    },
    {
        id: "av-mic-fail",
        category: "Hang és kép",
        question: "Miért nem működik a mikrofon?",
        answer:
            "Windows/macOS Adatvédelem beállításainál engedélyezd a mikrofont a böngészőnek. Zárd be a Zoomot, Discordot és más appokat, amelyek lefoglalhatják a mikrofont, majd indítsd újra a stúdiót.",
    },
    {
        id: "av-stutter",
        category: "Hang és kép",
        question: "Miért szakadozik a kép?",
        answer:
            "Ez általában gyenge feltöltési sávszélesség vagy túlterhelt Wi‑Fi. Menj közelebb a routerhez, kapcsold ki a VPN-t, és ne tölts fel közben mást. Az Adás előtt oldal hálózati tesztje is jelzi, ha kevés a sáv.",
    },
    {
        id: "av-quality",
        category: "Hang és kép",
        question: "Mit jelent a stream minőség figyelmeztetés?",
        answer:
            "A rendszer akkor jelez, ha a bitrate, az FPS vagy a HLS szegmensek elmaradnak. A nézőknél pixeles vagy akadozó lehet a kép. Csökkentsd a mozgást, javítsd a hálózatot, vagy indítsd újra a kamerát.",
    },
    {
        id: "pay-how",
        category: "Jegyek és bevételek",
        question: "Hogyan működik a jegyértékesítés?",
        answer:
            "A nézés ingyenes. A néző jegyeket a kérdésbeküldéshez, támogatáshoz és prémium funkciókhoz vesz. A te bevételed a Bevételek oldalon látszik, jutalék levonása után.",
    },
    {
        id: "pay-when",
        category: "Jegyek és bevételek",
        question: "Mikor kapom meg a bevételemet?",
        answer:
            "A kifizetést a Kifizetések oldalon kéred. Admin jóváhagyás után utalják. Pontos határidő a Tartalomkészítő ÁSZF és a kifizetési státusz szerint.",
    },
    {
        id: "pay-where",
        category: "Jegyek és bevételek",
        question: "Hol látom a bevételi adatokat?",
        answer:
            "A Tartalomkészítő felületen a Bevételek menü: jegyek, támogatás, összesítés műsoronként. A Ranglista a népszerűséget mutatja, nem a kifizetést.",
    },
    {
        id: "pay-payout",
        category: "Jegyek és bevételek",
        question: "Hogyan működik a kifizetés?",
        answer:
            "Add meg a kifizetési adatokat, majd indíts kérést a Kifizetések oldalon. A kérés pending → admin jóváhagyás → paid. Addig a bevétel a dashboardon gyűlik.",
    },
    {
        id: "aud-mod",
        category: "Közönségkezelés",
        question: "Hogyan moderáljak nézőt?",
        answer:
            "A Moderálás oldalon látod a kérdéslistát, a chatet és a bejelentéseket. Szabálytalan kérdést elutasíthatsz, chatüzenetet eltávolíthatsz. A tiltott szavak a platform szűrőjén mennek át.",
    },
    {
        id: "aud-ban",
        category: "Közönségkezelés",
        question: "Hogyan tiltsak le felhasználót?",
        answer:
            "Teljes fióktiltást az admin végez. Te a Moderálás oldalon a tartalmat (kérdés, chat, bejelentés) kezeled. Súlyos esetben küldj hibabejelentést vagy jelezd az adminnak.",
    },
    {
        id: "aud-lb",
        category: "Közönségkezelés",
        question: "Hogyan működik a ranglista?",
        answer:
            "A Ranglista a nézői aktivitás és a jegyek alapján sorolja a közönséget. Az élő overlayen is megjelenhet. Nem helyettesíti a Bevételek oldalt.",
    },
    {
        id: "plat-wish",
        category: "Platform funkciók",
        question: "Hogyan működik a kívánságfal?",
        answer:
            "A nézők nyilvános vagy privát kívánságot írhatnak. A Tartalomkészítő felületen a Kívánságfal menüben látod és kezelheted őket. Magánelérhetőséget (e-mail, telefon, Messenger) a rendszer szűri.",
    },
    {
        id: "plat-priv",
        category: "Platform funkciók",
        question: "Hogyan működnek a privát kérések?",
        answer:
            "A néző témát és határidőt ad meg, te árat és időpontot ajánlasz a csillagsávon belül. Elfogadás után privát adás készül. A listát a Privát kívánságok menüben találod.",
    },
    {
        id: "plat-links",
        category: "Platform funkciók",
        question: "Hol jelennek meg a nyilvános linkjeim?",
        answer:
            "A Profil oldalon, a bemutatkozás alatt adhatsz meg legfeljebb 5 https-linket (YouTube, Instagram, saját web, Discord-meghívó). A nézők csak az archív videó alatt látják, a lejátszó után, az értékelés előtt. Az élő oldalon, a chatben és a kérdésbeküldésnél nem jelennek meg. Ha módosítod a profilt, a régi archívok alatt is az új lista látszik.",
    },
    {
        id: "plat-rev",
        category: "Platform funkciók",
        question: "Mire való az értékelés?",
        answer:
            "A nézők a műsor után csillagot és szöveget adhatnak. Az Értékelések oldalon látod őket. A moderátor elrejtheti a szabálytalan értékelést.",
    },
    {
        id: "plat-modpage",
        category: "Platform funkciók",
        question: "Mire való a moderálás oldal?",
        answer:
            "Itt van a kérdés-sor, a chat moderálása és a nyitott bejelentések. Élőben a stúdióban a soron következő kérdés overlayen is megjelenik.",
    },
    {
        id: "tech-net",
        category: "Technikai követelmények",
        question: "Mekkora internet szükséges?",
        answer:
            "Stabil feltöltés kell (lehetőleg 5 Mbps felett, Wi‑Fi 5 GHz vagy jó mobilhálózat). Az Adás előtt oldal méri a kapcsolatot. Megosztott, terhelt Wi‑Fi gyakran kevés.",
    },
    {
        id: "tech-mobile",
        category: "Technikai követelmények",
        question: "Mobilról lehet streamelni?",
        answer:
            "Igen. A telefonos stúdió a LiveShow élő oldalán fut (kamera, mikrofon, ébren tartás). Chrome vagy Safari ajánlott, és ne kapcsold ki a képernyőt az adás alatt.",
    },
    {
        id: "tech-drop",
        category: "Technikai követelmények",
        question: "Mi történik hálózati hiba esetén?",
        answer:
            "A stúdió próbálja újracsatlakoztatni a jelet. Rövid kiesés után a nézők HLS-en vagy a kamerás preview-n várakozhatnak. Hosszabb hibánál a Riasztások oldalon megjelenik a hiba; az adást újra kell indítani.",
    },
    {
        id: "tech-pre",
        category: "Technikai követelmények",
        question: "Hogyan ellenőrizzem az eszközeimet adás előtt?",
        answer:
            "Az Adás előtt (preflight) oldalon: kamera, mikrofon, hang, hálózat. Zöld / sárga / piros jelzést kapsz. Pirosnál ne indíts adást, amíg a hibát nem javítottad.",
    },
];
