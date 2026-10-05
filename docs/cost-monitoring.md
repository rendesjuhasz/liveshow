# Költségmonitorozás

Streaming platformoknál a tárhely, a transzkód és a kimenő sávszélesség könnyen **nagyobb**, mint a jegyjutalék. Ez a lap a **mai stackhez** igazodik.

Admin: `/admin/costs` · API: `GET/PUT /admin/costs` (admin JWT).

## Mit mér a kód (használat)

| Tétel | Forrás | Mi NEM mérhető ma |
|-------|--------|-------------------|
| **Tárhely** | `uploads/`, `output/` (HLS + archív MP4), `BACKUP_DIR`, `mail-outbox/` bájt | Postgres adatkönyvtár; S3 (nincs) |
| **CDN** | nincs a repóban | Egress GB. A lejátszó az origin `/output` HLS-t kéri |
| **Transzkódolás** | helyi FFmpeg: élő `Stream.isLive` óra + e havi `Archive` darab × 0,3 ó becslés | Pontos CPU-óra, cloud MediaConvert |
| **Szerver** | nincs automata számlaimport | VPS havi díj — **te írod be** |
| **Adatbázis** | nincs | Managed PG díj, vagy 0 ha ugyanaz a VPS |
| **E-mail** | `EmailLog` darabszám a naptári hónapban, típus szerint | SMTP számla centjei, ha a provider más metrikát használ |

## Árak (Ft)

Admin űrlap, tábla `CostSettings`. Üres táblánál env:

| Env | Jelentés |
|-----|----------|
| `COST_STORAGE_GB_MONTH_FT` | Ft / GB / hó a mért lemezre |
| `COST_CDN_MONTHLY_FT` | Fix CDN/hó (0 = nincs CDN) |
| `COST_TRANSCODE_HOUR_FT` | Ft / FFmpeg-óra (0 = beleszámolva a VPS-be) |
| `COST_SERVER_MONTHLY_FT` | VPS számla |
| `COST_DB_MONTHLY_FT` | Managed Postgres / 0 |
| `COST_EMAIL_PER_1000_FT` | 1000 `EmailLog` / Ft |
| `COST_BUDGET_MONTHLY_FT` | Opcionális keret; túllépés jelzés az UI-n |

## Nyereség / veszteség

Összehasonlítás: **e havi platform jutalék** (fizetett jegycsomag + privát jegy × jutalék %) **mínusz** a hat tétel összege.

A streamer nettó **kifizetés**, nem fedezeti a VPS-t. Ha minden ár 0, a UI figyelmeztet: a margin hamis.

## Rejtett kockázatok ezen a stacken

1. `output/` archív MP4 **nem** törlődik magától — tárhely nő.
2. Élő HLS a saját gépről megy: nézőszám = origin sávszélesség (később CDN).
3. FFmpeg CPU a VPS-en: plusz transzkód-óra díj nélkül is elfogy a 2 vCPU.
4. SMTP nélkül az outbox fájlok is tárhely.

Kapcsolódó: [ops-inventory.md](./ops-inventory.md), [13-streaming.md](./13-streaming.md), `/admin/stats`.
