import Link from "next/link";
import LegalShell from "@/components/LegalShell";

export default function StreamerTermsPage() {
    return (
        <LegalShell title="Tartalomkészítő ÁSZF" updated="2026. augusztus 23.">
            <p>
                A tartalomkészítő fiók létrehozásával a felhasználó elfogadja a teljes{" "}
                <Link href="/aszf" className="text-yellow-400 underline">
                    Általános szerződési feltételeket
                </Link>
                , az{" "}
                <Link href="/adatkezeles" className="text-yellow-400 underline">
                    Adatkezelési tájékoztatót
                </Link>{" "}
                és a{" "}
                <Link href="/moderalasi-szabalyzat" className="text-yellow-400 underline">
                    Moderálási szabályzatot
                </Link>
                . Az alábbiak a tartalomkészítőkre vonatkozó kiemelések.
            </p>
            <p>
                A tartalomkészítő fiók létrehozásával a felhasználó vállalja, hogy a platformon csak
                jogszerű tartalmat közvetít, tiszteletben tartja a nézők adatait, és nem tölti
                fel más szellemi tulajdonát engedély nélkül.
            </p>
            <p>
                A tartalomkészítő felel a saját adásáért, a jegyárakért, a kifizetési adatok
                pontosságáért, valamint a moderálásért a saját műsoraiban a Platform
                szabályai szerint.
            </p>
            <p>
                A platform a közvetítés technikai hátterét biztosítja. A kifizetések az admin
                jóváhagyását követően történnek. A fiók a szabályok megsértése esetén
                felfüggeszthető vagy tiltásra kerülhet.
            </p>
            <p>
                A kapcsolattartási email a platform és a tartalomkészítő közötti hivatalos
                kommunikációra szolgál. Nem jelenik meg a nyilvános profilon, és nem
                használható a nézőkkel való közvetlen, platformon kívüli üzleti kapcsolatra.
                A jegyek, privát streamek és egyéb fizetős szolgáltatások a platformon
                keresztül bonyolítandók.
            </p>
            <p className="pt-4">
                <Link href="/streamer-register" className="text-yellow-400 underline">
                    Vissza a tartalomkészítő regisztrációhoz
                </Link>
            </p>
        </LegalShell>
    );
}
