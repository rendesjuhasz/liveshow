# 16. Roadmap

Ez nem szerződés, hanem **térkép**: mi van a kódban ma, mi a természetes következő lépés. Új fejlesztő innen lássa, merre ne duplikáljon.

Jelölés: **kész** a repo alapján; **részben**; **nincs**.

---

## 16.1 Már a termékben (ne építsd újra)

| Téma | Hol |
|------|-----|
| Kapcsolat oldal | `/kapcsolat`, `POST /api/contact`, `/admin/contact` |
| FAQ | `/faq`, homepage szekció, `/admin/faq` |
| Profil (néző) | `/profile` |
| Streamer profil | `/streamer/profile` |
| E-mail értesítések | regisztráció, jegy, emlékeztető, archív, streamer/payout, kapcsolat — **nem** in-app inbox |
| Ajándékjegy / kampány | `first_users`, `first_buyers`, admin gift — **nem** általános kuponkód |
| Jegy kategóriák | néző / interaktív / VIP |
| Kérdés + banned words + audit | moderátor |
| Értékelés + moderáció | |
| Payout kérelem + admin approve/paid | nincs banki utalás |
| Stripe / Barion / tesztfizetés | Barion ki, ha nincs merchant |
| Archív lista + generate | HLS ablak korlát — lásd streaming doc |
| Költségmonitorozás | `/admin/costs` — tárhely/CDN/transzkód/szerver/DB/e-mail vs jutalék |
| Jogi oldalak | ASZF, cookie, adatkezelés, stb. |

---

## 16.2 Részben / séma megvan, termék nincs kész

| Téma | Állapot | Irány |
|------|---------|--------|
| Chat | `ChatMessage` tábla, **nincs API/UI** | realtime moderált chat a live oldalra |
| WebRTC | signaling broadcast, nincs szoba | vagy kidobni, vagy showId room + auth |
| In-app értesítések | csak email + EmailLog | harang ikon, `Notification` tábla |
| Kuponrendszer | kampány ≠ kupon kód | `Coupon` / % kedvezmény checkoutnál |
| recording.mp4 | archív előnyben részesíti, ingest **nem írja** | FFmpeg második kimenet a teljes adásra |
| JWT_SECRET / éles CORS / API_URL env | kód hardcoded | [15-security.md](./15-security.md) P0 |
| Docker / CI | nincs | compose: postgres + api + web |
| `StreamingService` / `RtpListener` | holt kód | törölni vagy bekötni |
| Drizzle | függőség, Prisma a forrás | eltávolítani a zavart |

---

## 16.3 Nincs — későbbi epikek

| Téma | Megjegyzés |
|------|------------|
| Mobil app | natív / PWA; ma responsive web |
| CDN / transcoding ladder | egy bitrate x264 veryfast |
| RTMP ingest (OBS gomb) | ma UDP/RTP + FFmpeg; OBS-hez gyakran RTMP kellene |
| Stripe Connect / automatikus kifizetés | payout manuális |
| Többnyelvűség | UI magyar |
| Ajánlórendszer / kereső a feedben | lista + featured/live |
| 2FA admin | |
| DRM | HLS token csak „elég jó” paywall |
| Cluster / Kubernetes | ingest miatt egy node |

---

## 16.4 Javasolt sorrend (átvétel után)

1. **P0 security + env** (JWT, CORS, API_URL, confirm-dev lock) — nélkülözhetetlen bármely nyilvános deployhoz.
2. **Streaming stabilizálás** — ingest portütközés, teljes `recording.mp4`, OBS útmutató egy bitrate-re. Ez a platform szíve.
3. **Deploy + backup** — Nginx, PM2, `pg_dump`, `output/` stratégia.
4. **Chat** vagy **in-app értesítés** — user-facing, a séma / mail már ad alapot.
5. **Kupon** — marketing; a GiftCampaign mintát lehet bővíteni, ne keverd a payouttal.
6. **Mobil** — csak ha a web API stabil és a HLS mobil Safari-n OK (van native HLS ág a playerben).

---

## 16.5 Explicit nem-cél (amíg nincs döntés)

- Mikroszolgáltatás-bontás (a monolit szándékos)
- Barion élesítés merchant fiók nélkül
- `frontend_clean` továbbfejlesztése (másolat; a futó app a `frontend/`)

Új nagy feature: először ez a lista + [04-modulok.md](./04-modulok.md), aztán kód.
