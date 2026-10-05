import LegalShell from "@/components/LegalShell";

export default function AszfPage() {
    return (
        <LegalShell title="Általános szerződési feltételek (ÁSZF)" updated="2026. augusztus 23.">
            <p>
                A LiveShow platform (a továbbiakban: Platform) élő és archív műsorok közvetítését,
                jegyvásárlást, tartalomkészítő fiókokat és kapcsolódó szolgáltatásokat biztosít. A
                Platform használatával — ideértve a nézői vagy tartalomkészítő regisztrációt, a
                bejelentkezést és a jegyvásárlást — elfogadod ezeket a feltételeket.
            </p>

            <h2>1. Szolgáltató és a szerződés tárgya</h2>
            <p>
                A Platform a műsorok közzétételéhez, a jegyértékesítéshez, a közvetítés
                technikai hátteréhez, valamint a kifizetések adminisztrációjához ad felületet.
                A műsor tartalmáért elsősorban a közzétevő tartalomkészítő felel.
            </p>

            <h2>2. Fióktípusok</h2>
            <ul>
                <li>
                    <strong>Néző:</strong> az élő adások és az archív felvételek megtekintése
                    ingyenes (bejelentkezéssel). Jegyvásárlás az interaktív és prémium funkciókhoz
                    (kérdésbeküldés, támogatás, extra tartalom, privát stream).
                </li>
                <li>
                    <strong>Tartalomkészítő:</strong> külön regisztráció, profilkép és a Tartalomkészítő ÁSZF
                    elfogadása kötelező. A fiók pending státuszban jön létre, a vezérlőpult csak
                    admin jóváhagyás után érhető el.
                </li>
                <li>
                    <strong>Moderátor / admin:</strong> tartalom, felhasználók, kérdések,
                    értékelések és kifizetések kezelése.
                </li>
            </ul>
            <p>
                A fiók e-mail címhez kötött. A jelszót titokban kell tartani. Tiltott
                (banned) fiókkal a bejelentkezés nem lehetséges.
            </p>

            <h2>3. Műsorok és jegyek</h2>
            <p>
                A nyilvános katalógusban az aktív műsorok jelennek meg. A jegyvásárlás csak
                aktív műsorra vonatkozik. A jegykategóriák:
            </p>
            <ul>
                <li>Néző: az élő adás és az archívum megtekintése ingyenes, jegy nélkül</li>
                <li>Interaktív: kérdésbeküldés</li>
                <li>VIP: kérdésbeküldés, extra tartalmak és privát stream, ha a műsorhoz tartozik</li>
            </ul>
            <p>
                A fizetés a Platformon keresztül történik. A jegy a sikeres fizetés után paid
                státuszú. Ajándékjegyet az adminisztrátor oszthat ki. A jegy nem ruházható át
                a Platform felületén.
            </p>

            <h2>4. Élő adás, archívum, kérdések</h2>
            <p>
                Az élő közvetítés és az archív felvétel megtekintése ingyenes; a lejátszáshoz
                bejelentkezés szükséges. A kérdésbeküldés, a tartalomkészítő támogatása és a további
                prémium interakciók érvényes jegyhez kötöttek. A kérdések nem nyilvános csevegés:
                beküldés után függőben várnak, a tartalomkészítő mindig csak az aktuálisan legfontosabb
                kérdést látja. A kérdésbeküldés flood-, spam- és tiltottszó-szűrés alá esik.
            </p>

            <h2>5. Értékelések</h2>
            <p>
                Értékelni a műsor után, 1–5 csillaggal és opcionális szöveggel, érvényes
                jeggyel lehet. Az értékelés moderálásra vár; nyilvánosan csak a jóváhagyott
                értékelések és azok átlaga jelenik meg a műsoroldalon és a tartalomkészítő profilon.
            </p>

            <h2>6. Tartalomkészítőkre vonatkozó különös feltételek</h2>
            <p>
                A tartalomkészítő csak jogszerű tartalmat közvetíthet, tiszteletben tartja a nézők
                adatait, és nem tölti fel más szellemi tulajdonát engedély nélkül. Felel a
                saját adásáért, a jegyárakért, a kifizetési adatok pontosságáért.
            </p>
            <p>
                A bevételből a Platform jutalékot von (az aktuális mérték az admin
                beállítása szerint). Kifizetés a nettó egyenlegből igényelhető, pending →
                approved → paid folyamatban, admin jóváhagyással. A kapcsolattartási email
                a Platform és a tartalomkészítő közötti hivatalos kommunikációra szolgál, nem
                jelenik meg a nézőknek. A nézők és a tartalomkészítők egymás e-mail-címét vagy
                telefonszámát nem oszthatják meg; a kapcsolat a platformon belüli
                üzeneteken, kérdéseken, kívánságokon és privát ajánlatokon keresztül
                marad. A fiók a szabályok megsértése esetén elutasítható, felfüggeszthető
                vagy tiltásra kerülhet.
            </p>

            <h2>7. Szellemi tulajdon</h2>
            <p>
                A Platform szoftvere, arculata és dokumentációja a szolgáltatóé. A
                feltöltött műsor, kép, hang és szöveg a feltöltő felelőssége; a
                közzététellel a tartalomkészítő nem kizárólagos, a szolgáltatás működtetéséhez
                szükséges felhasználási jogot biztosít a Platformnak.
            </p>

            <h2>8. Felelősségkorlátozás</h2>
            <p>
                A Platform a technikai elérhetőséget ésszerű erőfeszítéssel biztosítja, de
                nem vállal szavatosságot a folyamatos, hibamentes működésért, a külső
                fizetési szolgáltatók, hálózati kimaradások vagy a tartalomkészítő által közzétett
                tartalom jogszerűségéért. A kártérítés a magyar jog kötelező szabályai szerint
                korlátozott.
            </p>

            <h2>9. Módosítás, irányadó jog</h2>
            <p>
                A feltételeket a Platform frissítheti; a hatályos szöveg mindig ezen az
                oldalon érhető el. A szerződésre a magyar jog az irányadó. A vitákat — ha
                kötelező fogyasztói fórum nem alkalmazandó — a szolgáltató székhelye szerint
                illetékes bíróság bírálja el.
            </p>
        </LegalShell>
    );
}
