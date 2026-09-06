import Link from "next/link";
import LegalShell from "@/components/LegalShell";
import CookieConsentControls from "@/components/CookieConsentControls";

export default function CookieTajekoztatoPage() {
    return (
        <LegalShell title="Cookie tájékoztató" updated="2026. augusztus 23.">
            <p>
                Ez a tájékoztató a LiveShow weboldalon használt sütikről (cookie) és a
                böngészőben tárolt, sütiszerű adatokról szól. A hozzájárulást a banneren
                vagy ezen az oldalon adhatod meg, illetve vonhatod vissza. Az adatkezelés
                részletei:{" "}
                <Link href="/adatkezeles" className="text-yellow-400 underline">
                    Adatkezelési tájékoztató
                </Link>
                .
            </p>

            <h2>1. Mi a süti</h2>
            <p>
                A süti egy kis adat, amelyet a böngésző tárol. Hasonló célra localStorage-t
                is használunk, például a cookie-hozzájárulás (`cookieConsent`) és a
                bejelentkezési token rögzítésére.
            </p>

            <h2>2. Szükséges működés</h2>
            <ul>
                <li>Bejelentkezés, munkamenet, fiókvédelem</li>
                <li>A cookie-hozzájárulás tárolása (`accepted` vagy `rejected`)</li>
                <li>Jegyhez kötött lejátszás technikai tokenjei</li>
            </ul>
            <p>
                Ezek a szolgáltatás nyújtásához kellenek. Elutasítás esetén a belépéshez
                szükséges tárolás továbbra is működhet, de opcionális (statisztikai,
                marketing) sütiket nem indítunk.
            </p>

            <h2>3. Opcionális sütik</h2>
            <p>
                Harmadik fél analitikai vagy marketing sütijét csak akkor használunk, ha a
                banneren az <strong>Elfogadom</strong> gombra kattintasz. Elutasítás után
                ezek nem töltődnek be.
            </p>

            <h2>4. Hozzájárulás és visszavonás</h2>
            <p>
                A döntést a böngésződ localStorage-ében tároljuk a `cookieConsent` kulcs
                alatt. A banner csak akkor jelenik meg újra, ha ez az érték hiányzik
                (például más böngésző, privát ablak, vagy törölted az oldal adatait).
            </p>

            <CookieConsentControls />
        </LegalShell>
    );
}
