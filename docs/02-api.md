# 2. API dokumentáció

**Alap URL:** `http://127.0.0.1:3200`  
**Nincs globális `/api` prefix.** A path a controller `@Controller()` értéke. Kivételek: `POST /api/contact`, `GET|POST /api/barion/webhook`.

**Auth:** `Authorization: Bearer <JWT>` (login / register válasz `access_token` mezője). Titok: `JWT_SECRET` (productionban kötelező). Access token lejárat 1 óra; refresh httpOnly cookie.

**JSON hibák (Nest alap):**

```json
{ "statusCode": 400, "message": "szöveg vagy tömb", "error": "Bad Request" }
```

| HTTP | Mikor |
|------|--------|
| 400 | érvénytelen input, üzleti szabály |
| 401 | nincs / hibás JWT |
| 403 | szerep / streamer státusz / HLS token |
| 404 | entitás nincs |
| 403 (HLS) | sima szöveg, nem JSON |

A frontend kliens: `frontend/api/http.ts`.

---

## 2.1 Nyilvános / auth

| Metódus | URL | Jog | Input | Output | Hibák |
|---------|-----|-----|-------|--------|-------|
| GET | `/` | — | — | liveness JSON | — |
| GET | `/health` `/health/live` | — | — | `{ status, service, uptimeSec }` | — |
| GET | `/health/ready` | — | — | db, ffmpeg, disk, smtp, storage | 503 ha nem kész |
| GET | `/health/uptime` | — | — | `{ status }` uptime monitoroknak | 503 |
| POST | `/auth/register` | — | `{ email, password }` | user + token | 400 létező email / gyenge adat |
| POST | `/auth/register-streamer` | — | `multipart/form-data`: `avatar` (kötelező kép), `name`, `email`, `password`, `bio`, `category`, `contactEmail`, `termsAccepted` | user + streamer pending + token | 400 nincs kép / nem elfogadott feltételek / MIME |
| POST | `/auth/login` | — | `{ email, password }` | `{ access_token, user }` | 401 rossz jelszó |
| GET | `/auth/me` | JWT | — | aktuális user + streamer státusz | 401 |

Avatar max 5 MB. Statikus: `GET /uploads/avatars/:file`.

---

## 2.2 Feed / műsorok (publikus)

| Metódus | URL | Jog | Input | Output |
|---------|-----|-----|-------|--------|
| GET | `/shows` | — | — | lista (eladható / látható státusz szerint a service szűr) |
| GET | `/shows/featured` | — | — | kiemelt |
| GET | `/shows/live` | — | — | élő |
| GET | `/shows/:id` | — | path | egy műsor |
| GET | `/streamers` | — | — | nyilvános streamer lista |
| GET | `/streamers/:id` | — | path | nyilvános profil |
| GET | `/ticket-categories` | — | — | `nezo` / `interaktiv` / `vip` + árak |
| GET | `/faq` | — | — | publikált FAQ |
| GET | `/archives` | — | — | publikus archív lista |
| GET | `/archives/:showId` | — | path | archív meta; logol `ViewEvent` kind=archive |
| GET | `/reviews/show/:showId` | opcionális JWT | path | jóváhagyott értékelések (+ saját pending, ha bejelentkezett) |
| GET | `/questions?showId=` | — | query `showId` | jóváhagyott kérdések |
| POST | `/api/contact` | — | `{ name, email, message }` | `{ ok: true }` | 400 hiányzó mező |

---

## 2.3 Jegyek és fizetés

Minden `/tickets/*` JWT.

| Metódus | URL | Input | Output | Hibák |
|---------|-----|-------|--------|-------|
| POST | `/tickets/buy` | `{ showId, categoryKey? }` | ticket DTO + `checkoutUrl` / fizetési infó | 400 nem vásárolható / nincs showId; 404 műsor |
| GET | `/tickets/my` | — | saját jegyek | 401 |
| GET | `/tickets/mine` | — | ugyanez | 401 |
| GET | `/tickets/show/:showId` | path | jegy erre a műsorra vagy null | 401 |

Jegy státuszok: `pending`, `paid`, `failed`, `cancelled`, `active`, `used`. Stream hozzáférés: `paid` **vagy** `active`.

| Metódus | URL | Jog | Input | Megjegyzés |
|---------|-----|-----|-------|------------|
| GET | `/payments/barion/status?paymentId=` | — | query | Barion `GetPaymentState` + helyi ticket frissítés |
| POST | `/payments/confirm-dev` | JWT | `{ ticketId }` | tesztfizetés, csak saját pending jegy |
| POST | `/payments/confirm-stripe` | JWT | `{ sessionId }` | Stripe session lezárása |
| GET | `/payments` | JWT+admin | — | összes Payment |
| GET/POST | `/api/barion/webhook` | — | query/body Barion | IPN; 200 OK |

Fizetős jegy checkout sorrend: Stripe ha `STRIPE_SECRET_KEY` → Barion ha `BARION_ENABLED=true` + POS + payee → különben `devPay` (teszt).

---

## 2.4 Stream / HLS / token

| Metódus | URL | Jog | Input | Output / hibák |
|---------|-----|-----|-------|----------------|
| GET | `/token/generate` | JWT | query: `streamId`, `showId`, `expires` (mp, default 3600), `purpose` (`live` / `archive` / `private`) | `{ token, expiresAt }` stream token (`STREAM_SECRET`); 403 ha nincs érvényes jegy |
| GET | `/livekit/config` | — | query `showId` | `{ backend: mesh\|livekit, configured, url }` élő videó flag |
| POST | `/livekit/token` | opcionális JWT | `{ showId, role: publisher\|viewer, viewerKey? }` | LiveKit AccessToken; publisher = tulajdonos; viewer = `assertCanWatch` |
| GET | `/output/:streamId/index.m3u8` | stream token | query `token`, `expiresAt`, `userId` | HLS playlist; **403** szöveg ha token rossz; **404** ha nincs fájl; **429** ha a néző 900/perc fölött (NAT IP 12 000/perc) |
| GET | `/output/:streamId/:segment` | stream token | ugyanaz | `.ts` / `.m4s` |
| GET | `/stream/:id/index.m3u8` | (streaming controller, hasonló HLS) | token query | alternatív path |
| GET | `/stream/:id/:segment` | | | |
| POST | `/ingest/start` | JWT+admin | `{ streamId, rtpPort }` | FFmpeg RTP ingest; 400 érvénytelen port (1024–65535) |

HLS token **nem** a user JWT. Külön HMAC/lejártás a `TokenService`-ben.

---

## 2.5 Streamer dashboard

Prefix: `/streamer`. Guard: JWT + **jóváhagyott** streamer (`StreamerApprovedGuard`). 403: nincs profil / pending / rejected / banned.

| Metódus | URL | Input | Funkció |
|---------|-----|-------|---------|
| GET | `/streamer/shows` | — | saját műsorok |
| POST | `/streamer/shows` | title, description, image, startTime/date, price, streamId/streamUrl, categoryKeys | draft műsor |
| GET | `/streamer/shows/:id` | — | egy műsor |
| POST | `/streamer/shows/:id/submit` | — | `pending` státusz (admin elbírálás) |
| PATCH | `/streamer/shows/:id` | mezők | szerkesztés |
| POST | `/streamer/shows/:id/live` | `{ live, streamId?, rtpPort? }` | élőre kapcsolás |
| GET | `/streamer/revenue` | — | bruttó/nettó/available |
| GET | `/streamer/payouts` | — | kifizetési kérelmek |
| POST | `/streamer/payouts` | `{ amount }` | kérelem; amount > 0 és ≤ available |
| GET | `/streamer/reviews` | — | saját műsorok értékelései |
| GET | `/streamer/questions?showId=` | query | jóváhagyott kérdések |
| PATCH | `/streamer/profile` | multipart: avatar + name, bio, category, contactEmail | profil |

JWT, streamer jóváhagyás nélkül is:

| Metódus | URL | Input | Funkció |
|---------|-----|-------|---------|
| GET | `/streamers/me` | — | saját dashboard infó |
| POST | `/streamers/me` | `{ name, bio }` | saját Streamer rekord |

---

## 2.6 Kérdések, értékelés, moderáció

ModeratorGuard: **admin vagy moderator** szerep (vagy bootstrap `admin@admin.com`).

| Metódus | URL | Jog | Input |
|---------|-----|-----|-------|
| GET | `/questions/mine?showId=` | JWT | saját kérdések |
| POST | `/questions` | JWT | `{ showId, text }` — pending / automatikus szűrés banned words |
| GET | `/questions/moderation?showId=` | mod | várólista |
| GET | `/questions/audit?showId=` | mod | audit log |
| PATCH | `/questions/:id/review` | mod | `{ status: approved\|rejected, note? }` |
| GET/POST | `/questions/banned-words` | mod | GET lista; POST `{ word }` |
| DELETE | `/questions/banned-words/:id` | mod | |
| POST | `/reviews` | JWT | `{ showId, rating, comment? }` pending |
| GET | `/reviews/moderation` | mod | pending értékelések |
| PATCH | `/reviews/:id/status` | mod | `{ status: approved\|rejected }` |

---

## 2.7 Admin

Prefix `/admin` (controller szinten Jwt+AdminGuard), **kivéve** a gyökéren lévő `GET/POST/PATCH/DELETE /admin/faq`, `GET /admin/contact`, `PUT /admin/ticket-categories`, `GET/POST/PATCH/DELETE /admin/streamers*`, `GET/POST/PATCH /admin/payouts*` — ezek is JWT+admin.

### Műsor, jegy, kampány, jutalék

| Metódus | URL | Body / megjegyzés |
|---------|-----|-------------------|
| POST | `/admin/shows` | title, description, image, date/startTime, price, live, featured, streamUrl, streamId, streamerId, categoryKeys, status |
| GET | `/admin/shows` | lista |
| GET | `/admin/shows/:id` | |
| PUT | `/admin/shows/:id` | ugyanaz mint create |
| PATCH | `/admin/shows/:id/status` | `{ status }` draft/pending/active/blocked/archived |
| DELETE | `/admin/shows/:id` | |
| GET | `/admin/shows/:id/archive` | |
| POST | `/admin/shows/:id/archive/regenerate` | |
| DELETE | `/admin/shows/:id/archive` | |
| GET | `/admin/stats` | nézettség, jegy, bevétel összesítő |
| GET | `/admin/costs` | tárhely/CDN/transzkód/szerver/DB/e-mail vs havi jutalék |
| PUT | `/admin/costs` | Ft egységárak (`storageGbMonthFt`, `cdnMonthlyFt`, …) |
| POST | `/admin/backups/:id/offsite` | S3/B2/Wasabi feltöltés + HeadObject |
| GET | `/admin/commission` | `{ commissionPercent }` |
| PUT | `/admin/commission` | `{ percent }` vagy `{ commissionPercent }` (0–90) |
| GET | `/admin/tickets` | minden jegy |
| POST | `/admin/tickets/gift` | `{ email, showId, categoryKey? }` |
| GET | `/admin/campaigns` | ajándék kampányok |
| POST | `/admin/campaigns` | name, type `first_users`\|`first_buyers`, showId, categoryKey, maxClaims, status, startsAt, endsAt |
| GET | `/admin/campaigns/:id` | |
| PATCH | `/admin/campaigns/:id` | |
| GET | `/admin/emails` | EmailLog utolsó ~80 |
| GET | `/admin/moderators` | |
| POST | `/admin/moderators` | `{ userId vagy email, role }` |
| GET | `/admin/users` | |
| GET | `/admin/users/:id` | |
| PATCH | `/admin/users/:id/status` | `{ status: active\|banned }` |
| POST | `/admin/users/:id/ban` | |
| POST | `/admin/users/:id/activate` | |
| GET | `/admin/streamers/:id` | |
| POST | `/admin/streamers/:id/approve\|reject\|ban` | |
| POST | `/admin/streamers/:id/activate` | = approved |
| GET | `/admin/streamers` | |
| POST | `/admin/streamers` | `{ name, email, bio, userId? }` |
| PATCH | `/admin/streamers/:id/status` | `{ status }` |
| DELETE | `/admin/streamers/:id` | |
| GET | `/admin/payouts` | |
| POST | `/admin/payouts` | `{ streamerId, amount }` |
| PATCH | `/admin/payouts/:id` | `{ status }` |
| POST | `/admin/payouts/:id/approve` | email trigger |
| POST | `/admin/payouts/:id/paid` | |
| GET | `/admin/contact` | kapcsolatűrlap üzenetek |
| GET | `/admin/faq` | minden FAQ |
| POST | `/admin/faq` | category, question, answer, order, isPublished |
| PATCH | `/admin/faq/:id` | |
| DELETE | `/admin/faq/:id` | |
| PUT | `/admin/ticket-categories` | `{ items: [{ key, price }] }` |
| GET | `/archive/:showId` | JWT+admin |
| POST | `/archive/generate/:showId` | FFmpeg archív |
| POST | `/archive/regenerate/:showId` | |
| DELETE | `/archive/:showId` | |

`GET /users` controller üres — felhasználók csak `/admin/users`.

---

## 2.8 AI marketing kit

JWT. `streamId` = Show UUID. Részlet: [marketing-kit.md](./marketing-kit.md).

| Metódus | URL | |
|---------|-----|--|
| POST | `/ai/marketing-kit/generate` | `{ streamId, language }` |
| GET | `/ai/marketing-kit/:streamId` | legújabb kit |
| PATCH | `/ai/marketing-kit/:kitId` | szerkesztés |
| POST | `/ai/marketing-kit/:kitId/publish` | Facebook / LinkedIn / X |

---

## 2.10 AI Safety Alerts

JWT. Részlet: [ai-safety-alerts.md](./ai-safety-alerts.md). `GET/POST /alerts`, Socket.IO `safety-alert`.

---

## 2.9 WebSocket (Socket.IO)

Gateway: ugyanazon a HTTP porton. CORS `origin: '*'`.

| Esemény (in) | Kimenet | Megjegyzés |
|--------------|---------|------------|
| `offer` | broadcast `offer` | nincs szoba / showId |
| `answer` | broadcast `answer` | minden más kliens |
| `ice` | broadcast `ice` | |

Nem authentikált. Élesben szobázni kell.

---

## 2.11 Frontend útvonalak (nem API)

Példák: `/`, `/shows`, `/live`, `/live/:id`, `/archive`, `/faq`, `/kapcsolat`, `/login`, `/register`, `/streamer-register`, `/profile`, `/streamer/*`, `/admin/*`, `/payment/success`, `/payment/failed`.
