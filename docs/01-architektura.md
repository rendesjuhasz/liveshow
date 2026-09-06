# 1. Architektúra

## 1.1 Áttekintés

A LiveShow **monolitikus** alkalmazás két folyamatban:

```
[Böngésző]  Next.js :3000
     |  REST JSON + Bearer JWT
     |  HLS GET (token query)
     |  Socket.IO (WebRTC signaling, opcionális)
     v
[API + ingest]  NestJS :3200
     |  Prisma / nyers SQL
     v
[PostgreSQL]  streaming
     |
     +-- FFmpeg (RTP → HLS, archív MP4)
     +-- fájlrendszer: uploads/, HLS output, mail-outbox/
     +-- külső: Stripe, Barion (opcionális), SMTP (opcionális)
```

**Nincsenek külön mikroszolgáltatások.** A Nest modulok egy folyamatban futnak. Nincs Docker Compose a repóban. Nincs Redis / RabbitMQ / Kafka.

## 1.2 Frontend (`frontend/`)

- Next.js App Router (`app/`)
- API kliens: `frontend/api/http.ts` → `API_URL = http://127.0.0.1:3200`
- Auth: `frontend/context/AuthContext.tsx` (token localStorage)
- Élő lejátszás: HLS.js, token a `/token/generate` után a playlist URL-en
- Publikus oldalak: műsorok, élő, archívum, FAQ, kapcsolat, jogi
- Szerep szerinti felületek: `/profile`, `/streamer/*`, `/admin/*`

## 1.3 Backend (`backend/src/`)

NestJS `AppModule` importjai (logikai modulok):

| Modul | Felelősség |
|-------|------------|
| AuthModule | regisztráció, login, JWT, streamer onboarding |
| UsersModule | üres controller (felhasználók az adminon) |
| ShowsModule | publikus műsorkatalógus |
| TicketsModule | jegy, kategória, ajándék kampány |
| PaymentsModule | Stripe / Barion / tesztfizetés |
| StreamersModule | publikus streamer, dashboard, payout API-k |
| QuestionsModule | kérdés + moderáció |
| ArchiveModule | archív generálás / publikus lista |
| StreamingModule + IngestModule + HlsModule | RTP ingest, HLS, FFmpeg |
| SecurityModule | stream JWT token |
| StatsModule | nézettség (ViewEvent, live heartbeat) |
| MailModule (global) | email sablon + SMTP/fájl outbox |
| AdminModule | admin CRUD |
| ContactModule | kapcsolatűrlap |
| FaqModule | FAQ |
| WebrtcGateway | Socket.IO offer/answer/ice |

**Nincs globális `setGlobalPrefix('api')`.** A path a controller `@Controller()` értéke. Kivétel: `POST /api/contact`, `GET|POST /api/barion/webhook`.

## 1.4 Adatáramlás – jegy és stream

```
Néző → POST /tickets/buy
     → Payment (pending) + Ticket (pending)
     → Stripe Checkout / Barion gateway / teszt confirm-dev
     → webhook vagy confirm → Ticket active/paid
     → GET /token/generate (JWT + érvényes jegy)
     → GET /output/:streamId/index.m3u8?token=&expiresAt=
     → HLS szegmensek
```

A **visszatérő URL** (`/payment/success`) nem hiteles visszaigazolás. Hiteles: Stripe/Barion állapot + webhook / `GetPaymentState`.

## 1.5 Adatáramlás – élő ingest

```
Streamer dashboard POST /streamer/shows/:id/live
  → (admin) POST /ingest/start { streamId, rtpPort }
  → UDP RTP listener + FFmpeg → HLS fájlok a lemezen
  → néző tokennel olvassa a playlistet
```

FFmpeg a hoston kell legyen (`PATH`).

## 1.6 Külső rendszerek

| Rendszer | Mikor | Hol |
|----------|-------|-----|
| PostgreSQL | mindig | `DATABASE_URL` |
| Stripe | `STRIPE_SECRET_KEY` kitöltve és Barion ki | `payments.service.ts` |
| Barion | `BARION_ENABLED=true` + POS Key + payee, és nincs Stripe elsőbbség | Stripe előbb, ha van kulcs; Barion utána; különben teszt |
| SMTP | `SMTP_HOST` + user + pass | `mail.service.ts` |
| FFmpeg | ingest / archív | child process |
| Socket.IO | WebRTC signaling | `webrtc.gateway.ts` |

Fizetési sorrend (fizetős jegy): **Stripe, ha van secret → Barion, ha engedélyezve → teszt (`devPay`)**.

## 1.7 Statikus fájlok

- `GET /uploads/*` → `backend/uploads` (avatar)
- HLS: projekt szerinti output könyvtár (`streaming/hls-paths.ts`)

## 1.8 Hibák és korlátok (átvételkor tudni kell)

- JWT secret kódba égetve (`secret123`) — élesben env-re kell vinni
- CORS csak localhost:3000
- WebRTC gateway minden peernek broadcastol (nincs szoba / showId)
- Statisztika tábla (`ViewEvent`) Prisma sémában nincs, runtime `CREATE TABLE IF NOT EXISTS`
- `PlatformConfig` (jutalék %) ugyanígy runtime SQL
- `node-media-server` függőségként szerepel, a fő ingest FFmpeg UDP
