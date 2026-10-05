export type AdminMenu = {
    href: string;
    title: string;
    /** Mit lehet ezen a menün csinálni. */
    canDo: string;
    featured?: boolean;
};

export const ADMIN_MENUS: AdminMenu[] = [
    {
        href: "/admin",
        title: "Vezérlőpult",
        canDo: "Itt látod az összes admin menüt, és a jóváhagyásra váró tartalomkészítőket.",
    },
    {
        href: "/admin/marketing",
        title: "Marketing központ",
        featured: true,
        canDo:
            "Automatikus klipek, posztok és ütemezés állítása. Élőben a nézőknek nincs reklám; a rendszer a háttérben dolgozik. Beállítások mentése, feladatok és klipek áttekintése.",
    },
    {
        href: "/admin/shows",
        title: "Műsorok kezelése",
        canDo:
            "Műsor létrehozása, szerkesztése, státusz (aktív / nem aktív), törlés. Archívum újragenerálása a műsor oldalán. A nézés ingyenes; az élő adás a tartalomkészítőtől függ.",
    },
    {
        href: "/admin/users",
        title: "Felhasználók",
        canDo:
            "Összes fiók keresése, profil megnyitása, tiltás és aktiválás. Itt a nézők, tartalomkészítők és adminok egy listában vannak.",
    },
    {
        href: "/admin/streamers",
        title: "Tartalomkészítők",
        canDo:
            "Jelentkezés jóváhagyása, elutasítása, tiltása, aktiválása. Új tartalomkészítő felvétele e-maillel, profil megnyitása, kifizetési adatok.",
    },
    {
        href: "/admin/questions",
        title: "Kérdések",
        canDo:
            "Műsoronkénti kérdéslista, tiltott tartalom elutasítása, audit napló, tiltott szavak felvétele és törlése. A sorrendet a rendszer számolja; a teljesítést a tartalomkészítő gombja.",
    },
    {
        href: "/admin/reports",
        title: "Jelentések",
        canDo:
            "Nézői bejelentések kérdésre, értékelésre, tartalomkészítőre, műsorra és chatre. Nyitottak szűrése, lezárás jegyzettel.",
    },
    {
        href: "/admin/reviews",
        title: "Értékelések",
        canDo:
            "Műsor utáni csillagos és szöveges értékelés jóváhagyása vagy elutasítása. Csak a jóváhagyottak jelennek meg nyilvánosan.",
    },
    {
        href: "/admin/moderators",
        title: "Moderátorok",
        canDo:
            "Felhasználó e-mail alapján moderátor vagy admin szerep adása. A lista a jelenlegi moderátorokat mutatja.",
    },
    {
        href: "/admin/private-pricing",
        title: "Privát stream ársávok",
        canDo:
            "1–5 csillagos sávok minimum és maximum árának beállítása. A tartalomkészítő csak ebben a sávban adhat ajánlatot.",
    },
    {
        href: "/admin/private-backups",
        title: "Privát biztonsági mentések",
        canDo:
            "Zárt körű felvételek listája (kb. 30 nap). Vita vagy káros tartalom esetén a fájl letölthető; nem nyilvános archívum.",
    },
    {
        href: "/admin/ticket-categories",
        title: "Jegycsomagok",
        canDo:
            "Alap, Ezüst, Arany, Gyémánt csomagár és jegyszám. Ezek kérdéshez és értékeléshez kellenek; az élő és az archív nézés ingyenes.",
    },
    {
        href: "/admin/tickets",
        title: "Jegyek",
        canDo:
            "Ajándék kérdésjegy kiosztása egy néző e-mailjére, kiosztott jegyek listája, e-mail újraküldése. Kampányos kiosztás az Ajándék kampányok menüben van.",
    },
    {
        href: "/admin/campaigns",
        title: "Ajándék kampányok",
        canDo:
            "Kampány: első X felhasználó vagy első X vásárló ingyenjegye a csomagegyenlegre. Létrehozás, szerkesztés, státusz.",
    },
    {
        href: "/admin/payments",
        title: "Kifizetések",
        canDo:
            "Platform jutalék és kifizetési ciklus. Tartalomkészítő kifizetés indítása, jóváhagyás, kifizetettnek jelölés, elutasítás, bizonylat. Beérkezett fizetések listája.",
    },
    {
        href: "/admin/referrals",
        title: "Ajánlóprogram",
        canDo:
            "Program ki/be, minimális vásárolt jegy, jutalom mennyiség. Ajánlások, statisztika, kiosztott jutalomjegyek. A jutalom nem számít eladásnak.",
    },
    {
        href: "/admin/monitoring",
        title: "Monitoring",
        canDo:
            "Health, élő streamek, backup státusz, SMTP hibák, ops riasztások. Gyors ellenőrzés, hogy a stack él-e.",
    },
    {
        href: "/admin/maintenance",
        title: "Karbantartás",
        canDo:
            "Azonnali vagy ütemezett karbantartás, érintett szolgáltatások, automatikus banner és korlátozás, napló. Nyilvános státusz: /status.",
    },
    {
        href: "/admin/backups",
        title: "Biztonsági mentés",
        canDo:
            "Adatbázis, média és konfiguráció mentés: lista, kézi futtatás, ellenőrzés, offsite feltöltés. Napi ütemezés a backendben megy.",
    },
    {
        href: "/admin/stats",
        title: "Statisztikák",
        canDo:
            "Jegycsomag-eladások, nézőszám, nézési idő, peak, archív nézettség, stream hibák, bevétel. Csak áttekintés, nincs szerkesztés.",
    },
    {
        href: "/admin/costs",
        title: "Költségek",
        canDo:
            "Havi tárhely, CDN, transzkód, szerver, adatbázis, e-mail Ft megadása. Összehasonlítás a platform jutalékkal.",
    },
    {
        href: "/admin/emails",
        title: "Email értesítések",
        canDo:
            "Kimenő automatikus levelek naplója (regisztráció, jegy, emlékeztető, archívum, jóváhagyás). SMTP nélkül a mail-outbox mappába esnek.",
    },
    {
        href: "/admin/contact",
        title: "Kapcsolat üzenetek",
        canDo:
            "A nyilvános Kapcsolat űrlap bejegyzéseinek olvasása. Innen nem lehet választ küldeni; a válasz e-mailben megy.",
    },
    {
        href: "/admin/faq",
        title: "FAQ",
        canDo:
            "Gyakori kérdés létrehozása, szerkesztése, törlése, kategória, sorrend, publikálás. Ez jelenik meg a súgó oldalon.",
    },
    {
        href: "/admin/i18n",
        title: "Nyelvek és fordítások",
        canDo:
            "Nyelvek felvétele, UI kulcsok fordítása, lefedettség, hiányzó szövegek, jóváhagyás. A műsorfordítás a műsor szerkesztőben is van.",
    },
    {
        href: "/admin/security",
        title: "Biztonság / 2FA",
        canDo:
            "Saját admin fiók TOTP kétlépcsős beállítása vagy kikapcsolása. Jelenleg nem kötelező a belépéshez.",
    },
];

export function adminMenuForPath(pathname: string): AdminMenu | undefined {
    const path = (pathname.split("?")[0] || "/").replace(/\/$/, "") || "/";
    if (path === "/admin") {
        return ADMIN_MENUS.find((m) => m.href === "/admin");
    }
    return ADMIN_MENUS.filter((m) => m.href !== "/admin")
        .slice()
        .sort((a, b) => b.href.length - a.href.length)
        .find((m) => path === m.href || path.startsWith(`${m.href}/`));
}
