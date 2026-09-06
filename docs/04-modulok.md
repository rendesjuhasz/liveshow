# 4. Modul dokumentáció

A Nest `AppModule` egy folyamat. Az alábbi „modulok” a termék funkciói; a feed a Shows + nyilvános listák, nem külön microservice.

---

## 4.1 Stream modul

**Funkció:** RTP ingest FFmpegmel, HLS kimenet, stream token, opcionális WebRTC signaling, élő kapcsolás a streamer dashboardról.

**Fájlok**

| Útvonal | Szerep |
|---------|--------|
| `backend/src/ingest/` | `POST /ingest/start`, FFmpeg UDP |
| `backend/src/hls/` | `GET /output/:streamId/...` |
| `backend/src/streaming/` | `GET /stream/:id/...`, HLS path helper |
| `backend/src/security/token/` | `GET /token/generate` |
| `backend/src/webrtc-signaling/webrtc.gateway.ts` | Socket.IO offer/answer/ice |
| `backend/src/streamers/streamer-dashboard.service.ts` | `setLive` |
| `frontend/app/live/`, `frontend/app/streamer/live/` | lejátszó / stúdió UI |

**API:** `/ingest/start` (admin), `/token/generate` (JWT + jegy), `/output/*`, `/stream/*`, WS események.

**Táblák:** Stream, Show (`live`, `streamId`), Ticket (hozzáférés), ViewEvent (playlist / token generate).

**Külső:** FFmpeg a PATH-on. `STREAM_SECRET` (default `dev-secret`) a HLS tokenhez. `node-media-server` függőség, a fő út FFmpeg.

---

## 4.2 Feed modul

**Funkció:** nyilvános műsor- és streamer-katalógus, kiemelt / élő listák, jegyár kategóriák, FAQ, archív lista — a kezdőoldal és `/shows` adatforrása.

**Fájlok**

| Útvonal | Szerep |
|---------|--------|
| `backend/src/shows/` | GET `/shows`, `/featured`, `/live`, `/:id` |
| `backend/src/streamers/streamers.controller.ts` | GET `/streamers` |
| `backend/src/tickets/ticket-categories.controller.ts` | GET `/ticket-categories` |
| `backend/src/faq/` | GET `/faq` |
| `backend/src/archive/public-archives.controller.ts` | GET `/archives` |
| `frontend/app/page.tsx`, `frontend/app/shows/` | UI |

**API:** lásd [02-api.md](./02-api.md) 2.2.

**Táblák:** Show, Streamer, TicketCategory, ShowTicketOffer, Faq, Archive.

**Szűrés:** `Show.status` (draft/pending nem publikus a service szerint), `featured`, `live`.

---

## 4.3 Értesítési modul

**Funkció:** e-mail sablonok, SMTP vagy fájl outbox, EmailLog, élő emlékeztető timer. Nincs push / in-app notification store. Nincs Redis / worker process.

**Fájlok**

| Útvonal | Szerep |
|---------|--------|
| `backend/src/mail/mail.service.ts` | queue = in-process `dispatch`, 60s interval |
| `backend/src/mail/mail.templates.ts` | típusok és HTML |
| `backend/mail-outbox/` | SMTP nélkül ide ír |
| `frontend/app/admin/emails/` | napló UI |

**API:** `GET /admin/emails`. Trigger-ek: [08-esemenyek-ertesitesek.md](./08-esemenyek-ertesitesek.md).

**Táblák:** EmailLog; olvas: Ticket, Show, User, Streamer, Payout, ContactMessage.

---

## 4.4 Kifizetési modul

**Funkció:** jegybevétel (paid/active) → jutalék (`PlatformConfig`) → available → streamer kérelem → admin approve/paid. **Nincs banki utalás automatizmus**, nincs cron payout.

**Fájlok**

| Útvonal | Szerep |
|---------|--------|
| `backend/src/payouts/commission.ts` | split, default 20% |
| `backend/src/payouts/platform-config.ts` | SQL config |
| `backend/src/payouts/revenue.ts` | `computeStreamerRevenue` |
| `backend/src/streamers/streamer-dashboard.controller.ts` | GET/POST `/streamer/payouts`, GET revenue |
| `backend/src/streamers/streamers.controller.ts` | `/admin/payouts*` |
| `backend/src/admin/admin.service.ts` | jutalék + ticket stats split |
| `frontend/app/streamer/payouts/`, `revenue/` | |

**API:** `/streamer/revenue`, `/streamer/payouts`, `/admin/payouts`, `/admin/commission`.

**Táblák:** Ticket, Show, Payout, PlatformConfig (SQL), Streamer.

Részletek: [09-kifizetes.md](./09-kifizetes.md).

---

## 4.5 Moderációs modul

**Funkció:** kérdések (banned words + pending review), értékelések, user/streamer tiltás (admin), műsor `blocked`. ChatMessage tábla nincs bekötve API-ra.

**Fájlok**

| Útvonal | Szerep |
|---------|--------|
| `backend/src/questions/` | QuestionsService, ModeratorGuard, BannedWord |
| `backend/src/streamers/reviews.controller.ts` + `reviews.service.ts` | |
| `backend/src/admin/admin-users.service.ts` | ban / activate |
| `frontend/app/admin/questions/`, `admin/reviews/`, `admin/users/` | |
| `frontend/app/moderalasi-szabalyzat/` | szabályzat oldal |

**API:** `/questions*`, `/reviews*`, `/admin/users/:id/ban`, show status `blocked`.

**Táblák:** Question, QuestionAudit, BannedWord, Review, User.status, Streamer.status, Show.status.

---

## 4.6 Onboarding modul

**Funkció:** néző regisztráció, streamer regisztráció (avatar + ÁSZF), pending → admin approve, streamer saját műsor draft → submit → admin show status.

**Fájlok**

| Útvonal | Szerep |
|---------|--------|
| `backend/src/auth/auth.controller.ts` | register, register-streamer, login |
| `backend/src/auth/auth.service.ts` | bcrypt, JWT, roleForEmail |
| `backend/src/streamers/streamer-approved.guard.ts` | dashboard kapu |
| `backend/src/streamers/status.ts` | státusz üzenetek |
| `frontend/app/register/`, `streamer-register/`, `streamer-terms/` | |
| `frontend/app/admin/streamers/` | jóváhagyás |

**API:** `POST /auth/register`, `POST /auth/register-streamer`, `POST /admin/streamers/:id/approve`, `POST /streamer/shows`, `POST /streamer/shows/:id/submit`, `PATCH /admin/shows/:id/status`.

**Táblák:** User, Streamer, Show, EmailLog (registration / streamer_approved).

**Bootstrap admin:** `admin@admin.com` email alapján admin, role mezőtől függetlenül (`BOOTSTRAP_ADMIN_EMAIL`).
