import Link from "next/link";
import LegalShell from "@/components/LegalShell";

export default function AdatkezelesPage() {
    return (
        <LegalShell title="Adatkezelési tájékoztató" updated="2026. augusztus 23.">
            <p>
                Ez a tájékoztató a LiveShow platformon (a továbbiakban: Platform) végzett
                adatkezelésről szól, a GDPR és az Infotv. szerinti transzparencia érdekében.
                A Platform üzemeltetője az adatkezelő. Kapcsolat: a fiókban megadott e-mail
                címen vagy a Platform adminisztrációján keresztül.
            </p>

            <h2>1. Milyen adatokat kezelünk</h2>
            <ul>
                <li>Regisztrációs adatok: e-mail, jelszó (titkosítva), szerepkör</li>
                <li>
                    Tartalomkészítő profil: név, bemutatkozás, kategória, kapcsolattartási e-mail,
                    profilkép, ÁSZF-elfogadás időpontja, jóváhagyási státusz
                </li>
                <li>Jegy- és fizetési adatok: műsor, jegykategória, státusz, fizetési azonosítók</li>
                <li>Beküldött kérdések és értékelések (csillag, szöveg, moderálási státusz)</li>
                <li>
                    Technikai naplók: bejelentkezés, élő/archív megtekintés statisztikai
                    célú eseményei, IP-cím és eszközadatok a szolgáltatás védelméhez
                </li>
            </ul>

            <h2>2. Célok és jogalapok</h2>
            <ul>
                <li>Szerződés teljesítése: fiók, jegy, közvetítés, kifizetés (GDPR 6. cikk (1) b)</li>
                <li>Jogi kötelezettség: számvitel, panaszkezelés (GDPR 6. cikk (1) c)</li>
                <li>
                    Jogos érdek: visszaélés-megelőzés, moderálás, statisztika, biztonság
                    (GDPR 6. cikk (1) f)
                </li>
                <li>Hozzájárulás: opcionális marketing, ha külön bekérjük (GDPR 6. cikk (1) a)</li>
            </ul>

            <h2>3. Címzettek</h2>
            <p>
                Az adatokat a Platform üzemeltetője, a megbízott tárhely- és fizetési
                szolgáltatók, valamint — a saját műsorukhoz szükséges körben — a tartalomkészítők
                (például jóváhagyott kérdések) kezelhetik. Hatóságnak csak jogszabály alapján
                adunk át adatot.
            </p>

            <h2>4. Megőrzés</h2>
            <p>
                A fiókadataidat a fiók fennállásáig, a számlázási adatokat a számviteli
                megőrzési időig, a moderálási és biztonsági naplókat a visszaélések
                kivizsgálásához szükséges ideig őrizzük, majd töröljük vagy anonimizáljuk.
            </p>

            <h2>5. Érintetti jogok</h2>
            <p>
                Kérheted a hozzáférést, helyesbítést, törlést, korlátozást, adathordozást,
                és tiltakozhatsz a jogos érdeken alapuló kezelés ellen. A hozzájárulás
                visszavonása nem érinti a korábbi kezelés jogszerűségét. Panasszal a
                Nemzeti Adatvédelmi és Információszabadság Hatósághoz (NAIH) fordulhatsz.
            </p>

            <h2>6. Adatbiztonság</h2>
            <p>
                A jelszavakat titkosítva tároljuk, az élő és archív megtekintés bejelentkezéshez
                kötött (jegy nélkül), a prémium lejátszás és interakció jegyhez, a tiltott
                fiókok nem léphetnek be. Teljes, abszolút biztonságot egyetlen online
                szolgáltatás sem tud garantálni.
            </p>

            <h2>7. Sütik</h2>
            <p>
                A bejelentkezéshez szükséges munkamenet-adatokat a böngészőben tároljuk.
                Ezek a szolgáltatás működéséhez kellenek. Harmadik fél analitikai sütijét
                csak elfogadás után használjuk. Részletek és a hozzájárulás kezelése:{" "}
                <Link href="/cookie-tajekoztato" className="text-yellow-400 underline">
                    Cookie tájékoztató
                </Link>
                .
            </p>
        </LegalShell>
    );
}
