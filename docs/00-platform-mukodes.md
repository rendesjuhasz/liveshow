# LiveShow — hogyan működik a platform

Ez a **termékleírás**: mit csinál az oldal, mit lát a néző / tartalomkészítő / admin.  
A fejlesztői API, adatbázis, deploy a többi `docs/` fájlban van.

Tesztcím: `https://streamtest.hu` (a gépeden fut, nem nonstop éles szerver).

---

## 1. Mi ez

Élő események és visszanézhető felvételek. A hangsúly az **élő tutoriál / magyarázat** irányán van. Már kész videó is feltölthető, de a platform **az élőt részesíti előnyben**.

**Felnőtt / 18+ / szexuális tartalom tilos.** Kizárást von maga után, nincs kivétel.

---

## 2. Ki kicsoda

| Szerep | Mit csinál |
|--------|------------|
| Vendég | Nézhet élőt és archívot, nem kérdez, nem ír kívánságot. |
| Néző | `/register` — jegy, kérdés, chat, követés, kívánságfal, értékelés. |
| Tartalomkészítő | `/streamer-register` — **admin jóváhagyásig pending**. Utána műsor, élő, VOD, kérdések, privát kérés. |
| Moderátor | Kérdés, jelentés, chat — nem a teljes admin. |
| Admin | `/admin/login` — jóváhagyás, műsor, FAQ, jegyár, jelentés, kifizetés, karbantartás. |

Tartalomkészítőnek **kötelező profilkép** és ÁSZF. A bióba ne kerüljön telefon vagy e-mail.

Teszt-admin (nem a gazda fiókja): `tesztelo@streamtest.hu`. Tesztelő ne nyúljon: Karbantartás, Biztonsági mentés, Kifizetések, másnak admin jog.

---

## 3. Mi ingyenes, mi fizetős

- **Az adás és az archív nézése ingyenes.** Jegy **nem** a lejátszáshoz kell.
- Jegy kell: **kérdés a tartalomkészítőnek**, **műsor utáni értékelés**, egyéb prémium interakció.
- Jegycsomagok: Alap, Ezüst, Arany, Gyémánt. Egy közös egyenleg.
- **Ajándék** küldhető műsor alatt és utána is (jegy / támogatás, ez **nem** kérdés a sorba).
- **Most** az archív megtekintésért **nincs kifizetés** a készítőnek: kevés a néző, reklám még nincs. Az élőben a készítő **ajánlhatja a saját ügyfeleit / szolgáltatását**.
- Később a jegybevételből a platform jutalékot von (alapból 20%), a maradékot a készítő kérheti; az utalás **manuális** (admin).

---

## 4. Élő: két külön üzenőfelület

1. **Kérdés a tartalomkészítőnek** — jegyes. A készítő **egyet** lát.
2. **Chat a nézők között** — egymásnak írnak. Tiltott szó / spam kiesik. Max 280 karakter, 3 másodpercenként.

A kettő nem keveredik.

---

## 5. Melyik kérdés kerül ki, ha sokan kérdeznek

A készítő **nem** kapja meg sorban az összes mondatot.

1. A rendszer **összecsoportosítja a hasonlót** (nem kell betűre ugyanaz).
2. Egy kupacban annyi a „támogatás”, **ahány különböző néző** kérdezte.
3. Kimegy a **legtöbb nézős** kupac. Holtverseny: a **régebbi**.
4. A képernyőn **egy szöveg**: a kupac **leghosszabb** megfogalmazása + hányan kérdezték.
5. Ami kint van, **ott marad**, amíg a készítő **megválaszolja** vagy **elutasítja** — még akkor is, ha közben más témát többen feltesznek.
6. Egyszerre max. **10 kérdező** lehet a műsoron. Tiltott szó / spam: automatikus elutasítás.

### Példa: 10 néző, a rendszer egynek számolja

Téma: videóvágás. Tíz ember ezt küldi:

1. Hogyan kell vágni a videót?  
2. Megmutatnád a videó vágását?  
3. Hogy kell vágni a videot?  
4. Videó vágás hogyan megy?  
5. Kérlek mutasd a vágást  
6. Hogyan vágjam a videót DaVinci-ben?  
7. Mi a videóvágás menete?  
8. Videót vágni hogy kell?  
9. Meg tudnád mutatni a vágást?  
10. Hogyan kell vágni?

**Egy kérdés** a készítőnél, pl. „Hogyan vágjam a videót DaVinci-ben?” — **10 néző**.  
„Milyen mikrofont használsz?” ettől **külön kupac**.

Hasonlónak számít: ugyanaz ékezet nélkül; vagy az egyik szöveg benne van a másikban (min. 12 karakter); vagy a lényeges szavak eléggé átfednek. A „a, az, hogy, kérlek…” kiesik.

---

## 6. Nézői út

Főoldal: kiemelt, hamarosan, élő, népszerű, visszanézhető.  
Menü: Élő, Visszanézés, Események, Tartalomkészítők, Ranglista.

Élő: `/live/...` — nézés ingyen, kérdés jeggyel, chat, ajándék, megosztás.  
Archív: `/archive/...` — nézés ingyen, értékelés jeggyel (jóváhagyás után nyilvános).  
Követés, kívánságfal (belépve).

E-mail megerősítés: SMTP nélkül a levél a szerver `backend/mail-outbox/` mappájába eshet, nem a postaládába. Meg nem erősített fiókkal kérdés / jegy / chat 403 lehet.

---

## 7. Tartalomkészítő út

1. Regisztráció → **pending**.  
2. Admin jóváhagy.  
3. Műsor, élő indítás, archív / VOD feltöltés, kérdések (egy kint lévő, válasz / elutasítás), kifizetési adatok, privát kérések.  
4. Privát stream ársávját az **admin** állítja; a készítő csak a sávban ajánl. A privát felvétel **nem** a nyilvános archívum (kb. 30 nap, vita / moderáció).  
5. Nyilvános profilon eseménykártyák; archívnál a rendszer állókép-kockát is kinyerhet borítónak.

---

## 8. Admin út

Készítő jóváhagyása/elutasítása, műsor, FAQ, jegyárak, jelentések, értékelés-moderálás, tiltott szavak.  
Tesztben **ne legyen cél**: karbantartás bekapcsolása, backup/restore, idegen fiók törlése, kifizetés „kifizetettnek” jelölése, új admin kiosztása.

---

## 9. Szándékos viselkedés — nem bug

- Nézés ingyenes, jegy a kérdéshez / értékeléshez kell.  
- Készítő pending, amíg nincs jóváhagyás.  
- Egy kérdés a készítőnél; 10 hasonló = 1 kupac.  
- A kint lévő kérdés nem ugrik le, ha más téma megelőzné.  
- Értékelés csak jóváhagyás után nyilvános.  
- Privát stream nem a nyilvános listán.  
- Archív nézésért **most** nincs készítői kifizetés.  
- A tesztoldal csak akkor él, ha a gép és a Tunnel megy.

---

## 10. Hol van a többi doksi

| Fájl | Számítógépes rész |
|------|-------------------|
| [01-architektura.md](./01-architektura.md) | Nest + Next, adatáramlás |
| [02-api.md](./02-api.md) | HTTP / WebSocket |
| [07-jogosultsagok.md](./07-jogosultsagok.md) | Szerepek a kódban |
| [09-kifizetes.md](./09-kifizetes.md) | Jutalék, payout |
| [13-streaming.md](./13-streaming.md) | Élő ingest, HLS, archív |
| [17-fejlesztes-es-teszteles.md](./17-fejlesztes-es-teszteles.md) | Fejlesztői teszt checklist |
| [18-cloudflare-tunnel.md](./18-cloudflare-tunnel.md) | `streamtest.hu` |
| [moderation.md](./moderation.md) | Jelentés, chat szűrő |
