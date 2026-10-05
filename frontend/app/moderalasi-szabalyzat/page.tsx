import LegalShell from "@/components/LegalShell";

export default function ModeralasiSzabalyzatPage() {
    return (
        <LegalShell title="Moderálási szabályzat" updated="2026. szeptember 9.">
            <p>
                Ez a szabályzat a LiveShow platformon a tartalom, a kérdések, az értékelések
                és a felhasználói fiókok kezelésére vonatkozik. A cél a jogszerű, zaklatás-
                és spammentes környezet.
            </p>

            <h2>1. Alapelvek</h2>
            <ul>
                <li>Tilos a jogellenes, gyűlöletkeltő, zaklató vagy szexuálisan kizsákmányoló tartalom.</li>
                <li>Tilos más művének, márkájának vagy személyes adatának engedély nélküli felhasználása.</li>
                <li>Tilos a spam, a flood, a manipulatív értékelés és a fizetési csalás.</li>
                <li>A műsor tartalmáért a közzétevő tartalomkészítő, a beküldött szövegért a szerződő felhasználó felel.</li>
            </ul>

            <h2>2. Műsorok</h2>
            <p>
                A tartalomkészítő által létrehozott műsor draft státuszban indul, majd pending
                jóváhagyásra vár. A nézők az active műsorokat látják. Az admin a műsort
                blokkolhatja vagy archiválhatja. Élő adás leállításakor a műsor archívumba
                kerülhet.
            </p>

            <h2>3. Kérdések (nem csevegés)</h2>
            <p>
                Interaktív és VIP jeggyel kérdés küldhető a műsorhoz. A kérdés pending
                státuszban vár. Moderátor vagy a műsor tartalomkészítője elutasíthat. A teljesítést
                a tartalomkészítő gombja végzi. Tiltott szavak, ismétlődő beküldés és a kérdezők
                létszámkorlátja automatikus szűrést vonhat maga után.
                E-mail-cím, telefonszám, messenger/telegram/whatsapp link vagy más külső
                kapcsolatfelvétel automatikusan blokkolt: a bevétel a platformon belüli
                jegy- és privátstream-tranzakciókból származik.
            </p>

            <h2>4. Értékelések</h2>
            <p>
                Értékelés csak a műsor után, érvényes jeggyel, 1–5 csillaggal és opcionális
                szöveggel adható. Az új vagy módosított értékelés pending. Nyilvánosan csak
                a                 jóváhagyott értékelések és azok átlaga jelenik meg. Az elutasított
                értékelést a nézők nem látják. Az értékelés szövege sem tartalmazhat
                személyes elérhetőséget.
            </p>

            <h2>5. Fiókok</h2>
            <p>
                A tartalomkészítő fiók pending, approved, rejected vagy banned lehet. A nézői fiók
                active vagy banned. Az admin saját magát és az admin fiókot nem tiltja.
                Tiltott fiókkal a belépés megtagadott.
            </p>

            <h2>6. Intézkedések</h2>
            <ul>
                <li>Tartalom elutasítása vagy eltávolítása</li>
                <li>Műsor blokkolása</li>
                <li>Fiók felfüggesztése vagy tiltása</li>
                <li>Kifizetés megtagadása visszaélés gyanúja esetén</li>
            </ul>
            <p>
                A döntés a Platform belátása szerint, a Moderálási szabályzat és az ÁSZF
                alapján születik. Ismételt vagy súlyos jogsértés esetén azonnali tiltás
                lehetséges.
            </p>

            <h2>7. Jelentések</h2>
            <p>
                Bejelentkezett, e-mailben megerősített néző jelentheti a tartalomkészítőt, az értékelést,
                a kérdést, a műsort és a chatüzenetet. Egy tartalmat felhasználónként egyszer.
                A nyitott jelentéseket a moderátor és a saját műsor tartalomkészítője látja.
            </p>

            <h2>8. Élő chat</h2>
            <p>
                Az élő chat nem helyettesíti a jegyes kérdésfolyamot. Ugyanaz a tiltott szó-,
                spam- és külső-kapcsolat szűrő fut, mint a kérdéseknél; a szabálytalan üzenet
                nem jelenik meg. A tartalomkészítő és a moderátor eltávolíthatja a látható üzenetet.
            </p>
        </LegalShell>
    );
}
