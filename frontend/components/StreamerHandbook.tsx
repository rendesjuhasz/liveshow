"use client";

import Link from "next/link";

export const STREAMER_HANDBOOK_VERSION = "v1.1";
export const STREAMER_HANDBOOK_UPDATED = "2026.09.27.";

const VERSION_HISTORY = [
    { ver: "v1.0", note: "Első nyilvános tartalomkészítő kézikönyv" },
    { ver: "v1.1", note: "Nyilvános linkek: profilon kezelés, megjelenés az archív videó alatt" },
    { ver: "v1.2", note: "Kisebb pontosítások és FAQ bővítések" },
    { ver: "v2.0", note: "Jelentős platformváltozások" },
];

const TOC = [
    { id: "bevezetes", label: "Bevezetés" },
    { id: "regisztracio", label: "Regisztráció és jóváhagyás" },
    { id: "dashboard", label: "A dashboard" },
    { id: "musor", label: "Műsor létrehozása" },
    { id: "elo-inditas", label: "Élő adás indítása" },
    { id: "studio", label: "Az élő stúdió" },
    { id: "kerdesek", label: "Kérdések" },
    { id: "kivansagok", label: "Kívánságfal" },
    { id: "bevetelek", label: "Bevételek és kifizetések" },
    { id: "moderalas", label: "Moderálás" },
    { id: "riasztasok", label: "Riasztások és hibák" },
    { id: "gyik", label: "Gyakori problémák" },
    { id: "segitseg", label: "Segítségkérés" },
];

function Tip({ children }: { children: React.ReactNode }) {
    return (
        <p className="my-4 rounded-xl border border-sky-500/30 bg-sky-950/40 px-4 py-3 text-sm text-sky-100">
            {children}
        </p>
    );
}

function Warn({ children }: { children: React.ReactNode }) {
    return (
        <p className="my-4 rounded-xl border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
            {children}
        </p>
    );
}

function Steps({ items }: { items: string[] }) {
    return (
        <ol className="my-4 list-decimal space-y-2 pl-5 text-neutral-200">
            {items.map((item) => (
                <li key={item}>{item}</li>
            ))}
        </ol>
    );
}

export default function StreamerHandbook() {
    return (
        <article className="max-w-3xl text-[17px] leading-relaxed text-neutral-200">
            <header className="mb-8">
                <p className="text-sm text-neutral-400">Verzió: {STREAMER_HANDBOOK_VERSION}</p>
                <p className="text-sm text-neutral-400">Utolsó frissítés: {STREAMER_HANDBOOK_UPDATED}</p>
                <p className="mt-4 text-neutral-300">
                    A kézikönyv a platform aktuális működése alapján készült. A tartalom változhat a
                    rendszer fejlesztésével és az új funkciók megjelenésével.
                </p>
            </header>

            <div className="mb-10 rounded-2xl border border-white/10 bg-neutral-900 p-5">
                <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-yellow-400">
                    Verziókezelés
                </p>
                <ul className="space-y-1 text-sm text-neutral-300">
                    {VERSION_HISTORY.map((row) => (
                        <li key={row.ver}>
                            <span className="font-semibold text-white">{row.ver}</span>
                            {" – "}
                            {row.note}
                        </li>
                    ))}
                </ul>
            </div>

            <nav aria-label="Tartalomjegyzék" className="mb-12 rounded-2xl border border-white/10 bg-neutral-900 p-5">
                <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-yellow-400">Tartalom</p>
                <ol className="grid gap-1 sm:grid-cols-2">
                    {TOC.map((item, i) => (
                        <li key={item.id}>
                            <a href={`#${item.id}`} className="text-sm text-accent hover:underline">
                                {i + 1}. {item.label}
                            </a>
                        </li>
                    ))}
                </ol>
            </nav>

            <section id="bevezetes" className="scroll-mt-8">
                <h2 className="mb-3 text-2xl font-bold text-white">1. Bevezetés</h2>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Mi a platform célja?</h3>
                <p>
                    A LiveShow élő beszélgetős műsorok helye. A nézők ingyen nézhetik az adást. Jegyeket
                    akkor vesznek, ha kérdezni, támogatni vagy extra funkciót szeretnének. Te a kamerád
                    mögött vezeted a műsort, a platform pedig a nézőket, a jegyeket és a kifizetést kezeli.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Hogyan működik a tartalomkészítő rendszer?</h3>
                <p>
                    Külön tartalomkészítő fiók kell (nem ugyanaz, mint a nézői belépés). Jóváhagyás után megnyílik
                    a <strong>Tartalomkészítő felület</strong>: itt készíted a műsort, ellenőrzöd a kamerát, mész
                    élőbe, moderálsz, és itt látod a bevételt. A nézői oldal a közönségé. A kettő között a
                    jobb felső profilmenüből válthatsz.
                </p>
                <Tip>
                    A stúdió Chrome-ban vagy Safariban megy jól. Facebook- vagy Instagram-ablakból a kamera
                    gyakran nem indul.
                </Tip>
            </section>

            <section id="regisztracio" className="mt-12 scroll-mt-8">
                <h2 className="mb-3 text-2xl font-bold text-white">2. Regisztráció és jóváhagyás</h2>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Regisztráció</h3>
                <p>
                    A nézői oldalon válaszd a Tartalomkészítő belépést, majd a tartalomkészítő regisztrációt. Add meg a
                    neved, e-mailed, jelszavad, rövid bemutatkozást, kategóriát és a kapcsolattartási
                    e-mailt. Fogadd el a Tartalomkészítő ÁSZF-et.
                </p>
                <Warn>
                    A bemutatkozásba ne írj telefon számot, Messenger-címet vagy más közvetlen elérhetőséget.
                    A nézőkkel a platformon keresztül beszéltek. Nyilvános közösségi linkeket később a Profil
                    oldalon, a „Nyilvános linkek” mezőben adhatsz meg.
                </Warn>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Kötelező profilkép</h3>
                <p>
                    A profilkép a regisztrációnál kötelező. Enélkül a fiók nem jön létre. Később a Profil
                    oldalon cserélheted.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">E-mail megerősítés</h3>
                <p>
                    Küldünk egy megerősítő levelet. Kattints a linkre. Amíg ez nincs meg, jegyet és tartalomkészítő
                    műveleteket nem tudsz intézni.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Admin jóváhagyás</h3>
                <p>
                    Az új fiók először várakozik. A dashboard csak akkor nyílik ki, amikor a platform
                    jóváhagyja. Addig egy rövid üzenetet látsz. Ha a fiók tiltott, a felület zárva marad.
                </p>
                <Steps
                    items={[
                        "Töltsd ki a tartalomkészítő regisztrációt profilképpel és ÁSZF-fel.",
                        "Erősítsd meg az e-mailt a levélben lévő linken.",
                        "Várd meg a jóváhagyást, majd lépj be a Tartalomkészítő belépésen.",
                    ]}
                />
            </section>

            <section id="dashboard" className="mt-12 scroll-mt-8">
                <h2 className="mb-3 text-2xl font-bold text-white">3. A tartalomkészítő vezérlőpult bemutatása</h2>
                <p className="mb-4">
                    Minden oldal tetején ott a cím, jobbra a <strong>Segítség</strong> gomb, alatta a menüsor.
                    A Profil a jobb felső név / kezdőbetű menüben van, nem a chip-sorban.
                </p>
                <ul className="space-y-3">
                    <li>
                        <strong className="text-white">Áttekintés</strong> — követők, nézettség, bevétel,
                        kifizethető összeg, ha van, a kifizetési emlékeztető. Innen a többi oldalra is
                        ugorhatsz.
                    </li>
                    <li>
                        <strong className="text-white">Saját műsorok</strong> — az összes adásod. Aktív:
                        még hátra lévő vagy meghirdetett. Archivált: lefutott, visszanézhető. Innen új
                        műsor és videófeltöltés.
                    </li>
                    <li>
                        <strong className="text-white">Élő adás</strong> — itt indítod a kamerás stúdiót.
                    </li>
                    <li>
                        <strong className="text-white">Ellenőrzés</strong> — két aloldal: <em>Adás előtt</em>{" "}
                        (eszközteszt) és <em>Riasztások</em> (hibák és figyelmeztetések).
                    </li>
                    <li>
                        <strong className="text-white">Bevételek</strong> — jegyek, platformlevonás, nettó,
                        műsoronkénti bontás.
                    </li>
                    <li>
                        <strong className="text-white">Kifizetések</strong> — összeg kérése és az előzmények.
                    </li>
                    <li>
                        <strong className="text-white">Ranglista</strong> — a közönség jegyek szerinti
                        sorrendje. Ezt nem te állítod.
                    </li>
                    <li>
                        <strong className="text-white">Értékelések</strong> — a műsoraidra kapott csillagok
                        és szövegek. Szabálytalant jelentheted.
                    </li>
                    <li>
                        <strong className="text-white">Moderálás</strong> — kérdések, chat, nézői jelentések.
                    </li>
                    <li>
                        <strong className="text-white">Kívánságfal</strong> — nyilvános kérések, amiket
                        vállalhatsz.
                    </li>
                    <li>
                        <strong className="text-white">Privát kívánságok</strong> — zárt, fizetős ajánlatok,
                        saját ársávoddal.
                    </li>
                    <li>
                        <strong className="text-white">Segítség</strong> — gyakori kérdések, hibabejelentés,
                        ez a kézikönyv.
                    </li>
                </ul>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Nyilvános linkek</h3>
                <p>
                    A jobb felső menü <strong>Profil</strong> oldalán, a bemutatkozás alatt adhatsz meg
                    legfeljebb <strong>5</strong> https-linket (címke + cím): YouTube, Instagram, TikTok,
                    saját web, Discord-meghívó (<code className="text-sm">discord.gg</code> vagy{" "}
                    <code className="text-sm">discord.com/invite</code>).
                </p>
                <p className="mt-3">
                    A nézők ezeket <strong>csak az archív videó oldalán</strong> látják, a lejátszó alatt,
                    az értékelő űrlap előtt. Az élő nézői oldalon, a videón overlayként, a chatben, a
                    kérdésbeküldésben és a támogatásnál <strong>nem</strong> jelennek meg.
                </p>
                <p className="mt-3">
                    Ha később módosítod a listát, a <strong>régi archívok alatt is az új linkek</strong>{" "}
                    látszanak — mindig a profil aktuális állapota. A bemutatkozásba továbbra se írj URL-t
                    vagy magánelérhetőséget; WhatsApp, Telegram, e-mail-link és URL-rövidítő ide sem tehető.
                </p>
                <Steps
                    items={[
                        "Nyisd a Profil szerkesztést a jobb felső menüből.",
                        "Nyilvános linkek: Link hozzáadása, címke és https cím, Mentés.",
                        "Ellenőrizd egy archív videó oldalán, a kép alatt.",
                    ]}
                />
            </section>

            <section id="musor" className="mt-12 scroll-mt-8">
                <h2 className="mb-3 text-2xl font-bold text-white">4. Műsor létrehozása</h2>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Új műsor</h3>
                <p>
                    Saját műsorok → <strong>Új műsor</strong>. Cím, kategória, leírás. A Stream ID-t hagyd
                    üresen, ha nem tudod, mi az — a rendszer kitölti.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Időpont</h3>
                <p>
                    Add meg a kezdés (és ha van, a befejezés) idejét a saját időzónádban. A nézők a Főoldal
                    <em>Hamarosan</em> listájában csak akkor látják, ha a kezdés a jövőben van. Az űrlap
                    eleve későbbi időpontra van kitöltve, ezt átírhatod.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Közzététel</h3>
                <p>
                    Mentés után a listában a <strong>Közzététel</strong>, vagy a szerkesztőben a{" "}
                    <strong>Közzététel a nézői oldalon</strong>. Kell cím és jövőbeli kezdés. Tiltott
                    műsort nem lehet közzétenni.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Követő értesítés</h3>
                <p>
                    Közzétételkor a követőid értesítést kaphatnak az új eseményről. Amikor tényleg élőbe
                    mész, külön „most élő” értesítés is mehet. Az Áttekintésen látod, hányan kaptak levelet,
                    és hányan kattintottak.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">AI marketing kit</h3>
                <p>
                    A műsor szerkesztője alatt. Egy gombbal poszt, SEO-szöveg, hírlevél, YouTube-leírás és
                    hashtag készül a műsorból (magyar vagy angol). Másolhatod, javíthatod. Ha összekötöd a
                    Facebook, LinkedIn vagy X fiókod, innen is kiposzthatod — azonnal vagy későbbi időpontra.
                </p>
                <p className="mt-4">
                    Kész videót élő nélkül is feltehetsz: Saját műsorok → <strong>Videó feltöltése</strong>{" "}
                    (cím, leírás, kategória, borítókép, MP4/MOV/WEBM). Ez rögtön a nyilvános archívumba
                    kerül.
                </p>
            </section>

            <section id="elo-inditas" className="mt-12 scroll-mt-8">
                <h2 className="mb-3 text-2xl font-bold text-white">5. Élő adás indítása</h2>
                <p>
                    Az Élő adás menüben csak a meghirdetett, még le nem játszott (vagy épp futó) műsorok
                    jelennek meg. Ha a lista üres, előbb hozz létre és tegyél közzé egy műsort.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Adás előtti ellenőrzés</h3>
                <p>
                    Az <strong>Adás előtt</strong> oldalon vagy az élő oldal tetején:{" "}
                    <strong>Teszt indítása</strong>. Kb. 5–10 másodperc. A telefon kérheti a kamera- és
                    mikrofonengedélyt — engedélyezd.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Kamera</h3>
                <p>
                    A teszt megnézi, van-e kép. Ha piros: más app (Zoom, Discord) foghatja a kamerát,
                    vagy nincs engedély. Zárd be a többit, frissítsd az oldalt.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Mikrofon</h3>
                <p>
                    Ugyanígy: engedély és szabad mikrofon. A rendszerhangot is itt ellenőrzöd, ne csak a
                    stúdióban derüljön ki, hogy némítva vagy.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Hálózat</h3>
                <p>
                    Méri a feltöltést, a pinget és a szakadozást, plusz hogy a stream szerver megkapja-e a
                    jelet. Eredmény: Kiváló, Jó, Gyenge vagy Kritikus — és javasolt minőséget is kapsz
                    (például 720p).
                </p>
                <Warn>
                    Kritikus teszt után az élő gomb piros („Mégis indítom”). Elindulhat, de a nézőknél
                    rossz lesz a kép. Előbb javítsd a Wi‑Fi-t vagy a kamerát.
                </Warn>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Élő indítás</h3>
                <Steps
                    items={[
                        "Futtasd a tesztet, amíg nem Kritikus.",
                        "Válaszd ki a műsort.",
                        "Nyomd: Élő adás indítása. A böngésző kéri a kamerát.",
                        "Hagyd nyitva ezt a fület. Ne kapcsold ki a telefont.",
                    ]}
                />
                <p>
                    Telefonon <strong>https</strong> cím kell (lakat a címsorban). Simán http-n a kamera
                    tiltva van. Ha új tunnel-címet kaptál, lépj be újra a Tartalomkészítő belépésen.
                </p>
            </section>

            <section id="studio" className="mt-12 scroll-mt-8">
                <h2 className="mb-3 text-2xl font-bold text-white">6. Az élő stúdió használata</h2>
                <p>
                    Indítás után a kép kitölti a képernyőt. Fent az óra (a színe a kapcsolatot mutatja) és
                    a nézőszám. Alul a gombok. <strong>Ne menj el az oldalról</strong> adás közben — a
                    rendszer figyelmeztet, és a jel megszakadhat.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Kamera váltás</h3>
                <p>A kör gombbal (váltás ikon) elölről hátulra, vagy vissza. Főleg telefonon hasznos.</p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Mikrofon</h3>
                <p>
                    Be- és kikapcsolás. Ha a hang eltűnik, a gomb pirosra vált — kapcsold ki-be, vagy
                    indítsd újra a kamerát a krízisképernyőn.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Zoom</h3>
                <p>Plusz közelebb, mínusz távolabb. Ne zoomolj annyira, hogy a kép életlen legyen.</p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Kérdés kezelés</h3>
                <p>
                    A néző kérdése a képernyő közepén / alján jelenik meg. Röviden koppints a zöld{" "}
                    <strong>Megválaszoltam, következő</strong> gombra, ha végeztél. Hosszan nyomva
                    előjön az elvetés: így dobod ki a kérdést anélkül, hogy megválaszolnád. A négyzet
                    ikon elrejti a gombokat, ha több képet szeretnél.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Leállítás</h3>
                <p>
                    A leállítás gombot <strong>két másodpercig</strong> kell nyomva tartani, aztán
                    megerősíted. Így véletlenül nem szakad meg az adás. Leállás után, ha volt felvétel, a
                    rendszer feltölti az archívumot. Üres teszt (nincs kép) nem kerül a visszanézésbe.
                    A műsor ezután archivált lesz.
                </p>
                <p className="mt-4">
                    Ha a kamera vagy a hálózat elszáll: Újracsatlakozás, Kamera újraindítása, Stream
                    helyreállítása. Ha csak háttérbe tetted a böngészőt: <strong>Adásban vagyok</strong>.
                </p>
            </section>

            <section id="kerdesek" className="mt-12 scroll-mt-8">
                <h2 className="mb-3 text-2xl font-bold text-white">7. Kérdések kezelése</h2>
                <p>
                    A néző jeggyel küld kérdést. Nincs külön „elfogadás” gomb: a sorban lévő kérdés
                    magától megjelenik a stúdióban, amikor rákerül.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Elfogadás — a gyakorlatban</h3>
                <p>
                    Ha a kérdés a képernyőn van, az azt jelenti, hogy a közönség is ezt látja. Válaszolj
                    élőben. Amikor kész vagy, a zöld gombbal lépsz a következőre — ezzel zárod a
                    jelenlegit, és hozod a soron következőt.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Elutasítás</h3>
                <p>
                    Moderálás → Kérdések fül: a függőben lévő tételnél <strong>Elutasítás</strong> (indok
                    opcionális). Stúdióban: hosszan a kérdésgombon → <strong>Kérdés elvetése</strong>.
                    Szabálytalan, spam vagy magánelérhetőséget kérő szöveget utasíts el.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Következő kérdés</h3>
                <p>
                    Rövid koppintás a zöld gombra. Ha nincs kérdés, a gomb szürke, és a felirat:
                    Várakozás kérdésre.
                </p>
                <Tip>
                    Ha többen ugyanazt kérdezik, a Riasztások / overlay jelezheti. Érdemes egyszer, hangosan
                    megválaszolni.
                </Tip>
            </section>

            <section id="kivansagok" className="mt-12 scroll-mt-8">
                <h2 className="mb-3 text-2xl font-bold text-white">8. Kívánságfal és privát kívánságok</h2>
                <p>
                    A <strong>Kívánságfal</strong> a nyilvános ötletek. <strong>Elfogadás</strong>:
                    vállalod, hogy később megcsinálod — ettől még nem „kész”.{" "}
                    <strong>Elutasítás</strong>: nem vállalod. <strong>Teljesítve</strong>: csak ha
                    tényleg megcsináltad; ekkor a beküldő jutalmat (XP, jelvény) kap.
                </p>
                <p className="mt-4">
                    A <strong>Privát kívánságok</strong> zárt kérések. A néző témát és határidőt ad. Te a
                    saját értékelési sávodban (csillagok alapján) adhatsz árat, leírod, hogyan valósítanád
                    meg, és 1–3 lehetséges időpontot. A néző választ és fizet. Az ársávot a rendszer
                    számolja, ne lépd túl.
                </p>
                <Warn>
                    Az ajánlat szövegébe se írj e-mailt, telefont, Messenger-címet. A kapcsolat a
                    platformon marad.
                </Warn>
            </section>

            <section id="bevetelek" className="mt-12 scroll-mt-8">
                <h2 className="mb-3 text-2xl font-bold text-white">9. Bevételek és kifizetések</h2>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">80/20 modell</h3>
                <p>
                    A nézés ingyenes. A bevétel a <strong>felhasznált fizetett jegyekből</strong> jön. A
                    bruttóból a platform jellemzően 20%-ot von le, neked 80% marad. A pontos százalék a
                    Bevételek oldalon látszik.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Fizetett jegyek</h3>
                <p>
                    Csak az számít, amit a néző tényleg elköltött a műsorodon (kérdés, támogatás, privát
                    funkció). Az <strong>ajándékjegy</strong> nem jár kifizetésben. Az archív
                    megtekintés szám csak tájékoztató. A privát jegy összege akkor válik kifizethetővé,
                    amikor a kapcsolódó műsort leadtad (leállítás vagy archívum).
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Kifizetés igénylés</h3>
                <p>
                    Előbb a Profilon mentsd a jogi nyilatkozatokat (számla, adó, szerződés, banki vagy
                    egyéb mód). A Kifizetések oldalon add meg az összeget (legfeljebb az „elérhető”
                    egyenleg), majd <strong>Kifizetés igénylése</strong>. A kérés először függőben van, az
                    admin jóváhagyja, utána utalják. Elutasításkor az összeg visszakerülhet az
                    egyenlegedbe.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Bizonylatok</h3>
                <p>
                    Jóváhagyott vagy kifizetett sornál a <strong>Bizonylat</strong> gomb letölt egy
                    összesítőt. A számlát te állítod ki a saját szabályaid szerint — a platform ezt nem
                    váltja ki.
                </p>
            </section>

            <section id="moderalas" className="mt-12 scroll-mt-8">
                <h2 className="mb-3 text-2xl font-bold text-white">10. Moderálás</h2>
                <p>
                    Válaszd ki a műsort. Három fül: <strong>Kérdések</strong>, <strong>Chat</strong>,{" "}
                    <strong>Jelentések</strong>.
                </p>
                <ul className="mt-3 list-disc space-y-2 pl-5">
                    <li>Kérdés: elutasítás, ha nem fér a műsorba.</li>
                    <li>Chat: a jóváhagyott üzenetet Eltávolítással veheted le.</li>
                    <li>
                        Jelentés: néző jelzett valamit a tartalmadról. <em>Elutasítás</em> = nincs teendő,{" "}
                        <em>Intézkedve</em> = te már léptél (például elrejtetted az üzenetet).
                    </li>
                </ul>
                <p className="mt-4">
                    Teljes fiókot te nem tiltasz: azt az admin intézi. Súlyos esetben küldj hibabejelentést.
                    A platformszintű értékeléseket a moderátorok bírálják; te a saját műsoraidat kezeled.
                </p>
            </section>

            <section id="riasztasok" className="mt-12 scroll-mt-8">
                <h2 className="mb-3 text-2xl font-bold text-white">11. Riasztások és hibák</h2>
                <p>
                    Élőben a rendszer figyeli a jelet, a nézőszámot, a chatet, a jegyeket és a szervert.
                    Az Ellenőrzés → Riasztások oldalon a teljes lista van; adás közben max. három kártya
                    úszik a sarokban.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Warning</h3>
                <p>
                    Sárga. Például késik a kép, alacsony a képkocka, esik a nézőszám, magas a szerverterhelés.
                    Még megy az adás, de javíts: közelebb a routerhez, kisebb mozgás, kevesebb párhuzamos
                    app.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Critical</h3>
                <p>
                    Piros. Nincs ingest, elszállt a kamera, nagyon gyenge a hálózat, vagy a szerver
                    túlterhelt. Újraindítás, újracsatlakozás, vagy állj le, és indítsd újra tisztán.
                </p>
                <p className="mt-3 text-sm text-neutral-400">
                    Kék / info: nem hiba, csak jelzés (sok néző, élénk chat, magas jegyeladás).
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Overlay gombok</h3>
                <ul className="mt-2 list-disc space-y-2 pl-5">
                    <li>
                        <strong>Eltüntetés</strong> — láttad, lekerül a kártya.
                    </li>
                    <li>
                        <strong>5 perc</strong> — később újra előjöhet, ha a gond megmarad.
                    </li>
                    <li>
                        <strong>Részletek</strong> — a hosszabb magyarázat.
                    </li>
                </ul>
                <p className="mt-3">
                    A Riasztások oldalon: Megnéztem, törlés, szűrők. Lent az értesítések: e-mail, böngésző
                    push, Discord, Telegram.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Hibabejelentés küldése</h3>
                <p>
                    Warning és critical kártya alatt: <strong>Nem találod a megoldást?</strong> → Hibabejelentés
                    küldése. Ugyanaz az űrlap, mint a Segítség menüben.
                </p>
            </section>

            <section id="gyik" className="mt-12 scroll-mt-8">
                <h2 className="mb-3 text-2xl font-bold text-white">12. Gyakori problémák és megoldások</h2>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Nincs hang</h3>
                <p>
                    Nézd a mikrofon gombot (ne legyen némítva). Böngésző engedély: Hang / Mikrofon =
                    Engedélyezve. Zárd a Discordot és a Zoomot. Futtasd újra az Adás előtt tesztet.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Nincs kép</h3>
                <p>
                    HTTPS, Chrome vagy Safari. Engedély a címsor lakatánál. Más app ne foglalja a kamerát.
                    Próbáld a kamera váltást vagy a Kamera újraindítását.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Hálózati probléma</h3>
                <p>
                    Stabil Wi‑Fi (lehetőleg 5 GHz) vagy jó mobilhálózat. Kapcsold ki a VPN-t. Ne tölts fel
                    közben mást. Az óra színe és a preflight mutatja, ha kevés a sáv.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Stream megszakad</h3>
                <p>
                    Maradj a stúdiófülön. Használd az Újracsatlakozást. Ha sokáig nincs jel, állítsd le,
                    és indítsd újra az Élő adás oldalról. A Riasztásokon megjelenik az ingest / HLS hiba.
                </p>
                <h3 className="mb-2 mt-6 text-lg font-semibold text-yellow-400">Kifizetéssel kapcsolatos kérdések</h3>
                <p>
                    Csak a felhasznált fizetett jegy számít. Az elérhető összeg a Bevételek / Kifizetések
                    oldalon. A kérés addig függőben van, amíg az admin nem hagyja jóvá. Hiányzó adat: Profil
                    → számla / adó / szerződés. Ha az összeg nem stimmel, írd meg hibabejelentésben
                    (típus: Kifizetés).
                </p>
            </section>

            <section id="segitseg" className="mt-12 scroll-mt-8">
                <h2 className="mb-3 text-2xl font-bold text-white">13. Segítségkérés</h2>
                <p>
                    Jobb felül mindig: <strong>Segítség</strong>. Három pont:
                </p>
                <ul className="mt-3 list-disc space-y-3 pl-5">
                    <li>
                        <strong>FAQ</strong> —{" "}
                        <Link href="/streamer/help/faq" className="text-accent underline">
                            Gyakori kérdések
                        </Link>
                        . Rövid válaszok adásra, hangra, jegyre, moderálásra. Ez a nézői FAQ-tól külön van.
                    </li>
                    <li>
                        <strong>Hibabejelentés</strong> —{" "}
                        <Link href="/streamer/help/contact" className="text-accent underline">
                            Kapcsolat űrlap
                        </Link>
                        . Típus (élő, hang, kép, kifizetés, moderálás, egyéb), leírás, opcionális
                        képernyőkép. A neved és e-mailed a fiókból megy.
                    </li>
                    <li>
                        <strong>Platform útmutató</strong> — ez az oldal. Olvasd végig belépés után, az első
                        adás előtt.
                    </li>
                </ul>
                <Tip>
                    Ha elakadtál adás közben, ne a nézői Kapcsolat oldalt keresd: a Segítség menü a
                    dashboardon marad, a stúdió chrome-ja miatt a lap alja nincs ott.
                </Tip>
            </section>

            <aside className="mt-12 rounded-2xl border border-white/10 bg-neutral-900 p-6">
                <p className="text-lg font-semibold text-white">Nem találod a választ?</p>
                <ul className="mt-3 list-disc space-y-2 pl-5">
                    <li>
                        <Link href="/streamer/help/faq" className="text-accent underline">
                            Gyakori kérdések
                        </Link>
                    </li>
                    <li>
                        <Link href="/streamer/help/contact" className="text-accent underline">
                            Hibabejelentés küldése
                        </Link>
                    </li>
                    <li>
                        <Link href="/streamer/help/contact" className="text-accent underline">
                            Kapcsolat az üzemeltetővel
                        </Link>
                    </li>
                </ul>
                <p className="mt-5 text-sm text-neutral-400">Verzió: {STREAMER_HANDBOOK_VERSION}</p>
                <p className="text-sm text-neutral-400">Utolsó frissítés: {STREAMER_HANDBOOK_UPDATED}</p>
            </aside>
        </article>
    );
}
