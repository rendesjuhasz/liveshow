# 17. Fejlesztés és tesztelés

Ez a dokumentum a **napi munkához** kell: hogyan indítod a stacket, mit tölts ki, hogyan tesztelsz szerepkörönként, és hol akad el a rendszer. A részletes API / DB / streaming leírások a többi `docs/*.md` fájlban vannak.

**Stack:** NestJS 11 API `http://127.0.0.1:3200` + Next.js 16 UI `http://localhost:3000` + PostgreSQL. Nincs Docker a repóban. A futó app a `frontend/` mappa (`frontend_clean` másolat, ne azt indítsd).

---

## 17.1 Előfeltételek

| Eszköz | Miért |
|--------|--------|
| Node.js 20+ (LTS; 24 is jó) | backend + frontend |
| npm | csomagok |
| PostgreSQL 14+ | Prisma |
| FFmpeg a PATH-on | élő ingest + archív |
| Git | |

Opcionális: Redis (`REDIS_URL`) — fejlesztésben memória-limiter is elég. SMTP — hiányában a levelek a `backend/mail-outbox/` mappába kerülnek. Stripe / Barion — jegyhez fejlesztésben `confirm-dev` is elég.

---

## 17.2 Első telepítés

```powershell
# 1) Adatbázis
# Hozz létre egy DB-t, pl. streaming
# docker példa: docker run --name liveshow-pg -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=streaming -p 5432:5432 -d postgres:16

# 2) Backend
cd backend
npm install
copy .env.example .env   # ha még nincs .env
# töltsd ki: DATABASE_URL, JWT_SECRET, STREAM_SECRET (lásd 17.3)
npx prisma migrate deploy
npx prisma generate

# 3) Frontend
cd ..\frontend
npm install
```

Titkok generálása PowerShellben (másold a `.env`-be, **ne commitold**):

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Futtasd kétszer: egyszer `JWT_SECRET`, egyszer `STREAM_SECRET`. Ha a JWT titkot cseréled, **mindenki újra belép**.

---

## 17.3 Kötelező `backend/.env`

A backend a `backend/.env` fájlt tölti (a `main.ts` a backend könyvtárhoz képest, a cwd-től függetlenül). A fájl gitignore-olt.

| Változó | Fejlesztés | Production | Megjegyzés |
|---------|------------|------------|------------|
| `DATABASE_URL` | kötelező | kötelező | Prisma |
| `JWT_SECRET` | **kötelező** | kötelező | Nincs fallback. Hiány → a process nem indul. |
| `STREAM_SECRET` | **kötelező** | kötelező | HLS + signed `/media` HMAC. Nincs fallback. |
| `PORT` | 3200 | 3200 | |
| `FRONTEND_URL` | `http://localhost:3000` | éles origin | e-mail linkek, fizetés return |
| `BACKEND_URL` | `http://127.0.0.1:3200` | publikus API | Barion webhook |
| `BOOTSTRAP_ADMIN_EMAIL` | opcionális; default `admin@admin.com` | **kötelező**, nem lehet `admin@admin.com` | Ezzel a címmel regisztrált user admin + email verified |
| `ALLOW_DEV_PAY` | default be (ha nincs `false`) | mindig ki | Teszt jegyfizetés `POST /payments/confirm-dev` |
| `REDIS_URL` | ajánlott | kötelező | Rate limit több példányra |
| `ADMIN_EMAIL` | kapcsolat | ops | |

Teljes lista: [12-env.md](./12-env.md). Éles pipálás: [production-env-checklist.md](./production-env-checklist.md).

Frontend: böngészőben az API **ugyanazon origin** `/api/...` rewrite-ja (`next.config.ts` → `localhost:3200`). Opcionális `NEXT_PUBLIC_API_URL` szerveroldali fetchhez (default `http://127.0.0.1:3200`).

---

## 17.4 Indítás (két terminál)

**Mindig a `backend` és `frontend` mappából**, és **egyszerre csak egy** folyamat portonként.

```powershell
cd backend
npm run start:dev
```

Siker: `Nest application successfully started` **és nincs** `EADDRINUSE`. Health: http://127.0.0.1:3200/health

```powershell
cd frontend
npm run dev
```

UI: http://localhost:3000  
LAN / telefon (néző, belépés): **`http://<PC-Wi-Fi-IP>:3000`**  
Telefonos **kamera**: saját HTTPS tanúsítványt a telefonok általában elutasítják. Stabil teszt: Cloudflare **elnevezett** tunnel a `https://streamtest.hu` domainre → `localhost:3000` ([18-cloudflare-tunnel.md](./18-cloudflare-tunnel.md)). Gyors, egyszeri URL: `scripts\start-cloudflare-tunnel.cmd` (`https://….trycloudflare.com`). PC-n a kamera HTTP-n is megy: `http://localhost:3000/streamer/live`.

### Port foglalt (`EADDRINUSE`)

| Port | Szolgáltatás |
|------|----------------|
| 3000 | Next |
| 3200 | Nest |

Windows:

```powershell
netstat -ano | findstr "LISTENING" | findstr ":3200"
taskkill /PID <pid> /T /F
```

Ugyanez `:3000`-re. Ne indítsd az IDE-ből **és** egy másik `npm run start:dev` / `node dist/main` folyamatot egyszerre.

---

## 17.5 Auth, süti, CSRF (teszteléshez kötelező tudni)

A session **nem** `sessionStorage` access token.

| Süti | Szerep |
|------|--------|
| `ls_access` | HttpOnly JWT (~1 óra) |
| `ls_refresh` | HttpOnly refresh (~7 nap) |
| `ls_csrf` | CSRF double-submit |
| `ls_hls` | HttpOnly HLS token (rövid TTL) |

A frontend `apiFetch` `credentials: "include"` + mutató kéréseken `X-CSRF-Token`.

**Postman / curl:** `POST /auth/login` után a Set-Cookie-t tartsd meg. Mutató kéréseknél küldd a CSRF sütit **és** az `X-CSRF-Token` headert (ugyanaz az érték). Skip lista (CSRF nélkül): login, register, forgot/reset/verify, refresh, Barion, Stripe webhook.

**JSON extra mező** mutató body-ban → `400` (`forbidNonWhitelisted`). A body-nak a DTO mezőire kell szűkülnie.

---

## 17.6 Fiókok és szerepek

| role | Hol |
|------|-----|
| `user` | `/register` |
| `streamer` | `/streamer-register` — dashboard csak `Streamer.status = approved` után |
| `moderator` | admin `/admin/moderators` |
| `admin` | bootstrap email **vagy** `User.role = admin` |

Fejlesztésben a bootstrap email default: **`admin@admin.com`**. Regisztráld ezt a címet `/register`-en — admin lesz, és az email verified flag is bekapcsol.

SQL (ha már van user):

```sql
UPDATE "User" SET role = 'admin', "emailVerified" = true WHERE email = 'te@pelda.hu';
```

Streamer jóváhagyás: `/admin/streamers` → approve, vagy SQL `Streamer.status = 'approved'`.

**Email verify:** SMTP nélkül a link a `backend/mail-outbox/` HTML-ben van. Jegyvásárlás, kérdés, chat: `EmailVerifiedGuard` — nem verified user 403.

---

## 17.7 UI térkép

| Útvonal | Ki |
|---------|-----|
| `/`, `/shows`, `/live`, `/archive`, `/streamers`, `/faq`, `/kapcsolat` | publikus |
| `/login`, `/register`, `/streamer-register`, `/forgot-password`, `/verify-email` | auth |
| `/profile`, `/tickets` | belépett néző |
| `/live/[showId]` | élő lejátszó (jegy / admin) |
| `/streamer/*` | approved streamer |
| `/admin/*` | admin |
| `/en/...` stb. | locale prefix (hu a default, nincs `/hu`) |

---

## 17.8 Manuális teszt — néző

1. Regisztráció (nem bootstrap email) → outbox verify link → `/verify-email?token=`
2. Login → headerben név / kijelentkezés
3. `/shows` → műsor lap → jegy vásárlás
4. Fejlesztésben fizetés: a UI `confirm-dev` (nincs Stripe/Barion, vagy `ALLOW_DEV_PAY` be)
5. `/tickets` — aktív jegy
6. `/live/[id]` — player tölt; 403 jegy nélkül
7. Kérdés / chat / értékelés a műsoron (kategória entitlements)
8. Logout → `/auth/me` 401, süti törlődik

Ellenőrizd: extra JSON mező a login body-ban 400. Avatar URL `/media/avatars/...?...e=&s=` (nem nyilvános `/uploads`).

---

## 17.9 Manuális teszt — streamer

1. `/streamer-register` vagy néző + streamer profil
2. Admin approve
3. `/streamer` dashboard, `/streamer/shows/new` — **streamId** kötelező élőhöz
4. Cover / avatar feltöltés — JPEG/PNG/WebP/GIF, SVG tiltva
5. `/streamer/shows/[id]` submit → admin show status
6. Élő: ingest (admin `/ingest/start` + FFmpeg) vagy meglévő `output/<streamId>/index.m3u8`
7. Jóváhagyott kérdés next/reject, chat hide, payout kérés

---

## 17.10 Manuális teszt — admin

Bootstrap `admin@admin.com` (csak **nem-éles**).

1. `/admin` — stat, show lista
2. Show create/edit, status, archive regenerate
3. User ban/activate, streamer approve
4. Jegy ajándék, ticket pack/category
5. FAQ, i18n, referrals, costs, backups, ops/health
6. Production próba **ne** `admin@admin.com` bootstrappal — a boot elszáll

---

## 17.11 HLS / média (amit a tesztelő lát)

| Dolog | Viselkedés |
|-------|------------|
| Token | `GET /token/generate?streamId=&showId=&purpose=live\|archive\|private` — JSON-ben **nincs** token, HttpOnly `ls_hls` |
| TTL | élő 120 s, archív 300 s; a player ~60 s-enként frissít |
| Kötés | HMAC: `streamId:expiresAt:userId:ip` — más IP → 403 |
| Playlist | same-origin `/output/<streamId>/index.m3u8` (Next rewrite), cookie megy |
| 403 | sima szöveg, nem JSON |
| `/uploads` | **nincs** statikus kiszolgálás |
| Képek | `/media/avatars\|covers/<file>?e=&s=` 1 órás aláírás |

Mobil IP-váltás (4G) elronthatja a HLS sütit — várható 403, token újragenerálás.

Részletek: [13-streaming.md](./13-streaming.md).

---

## 17.12 Automatizált tesztek

```powershell
cd backend
npm test
```

Jest: `backend/src/**/*.spec.ts`. A `jest.env.ts` beállít teszt `JWT_SECRET` / `STREAM_SECRET` értékeket.

Hasznos csomagok: auth (verify, reset), token HMAC+IP, rate-limit, sanitizer, ingest ffmpeg args, marketing crypto, referrals, payout cycle, timezones, question filters.

```powershell
npm run test:e2e
```

Config: `backend/test/jest-e2e.json` — jelenleg **nincs** `*.e2e-spec.ts` a repóban; a parancs üresen lefut vagy no tests.

```powershell
cd frontend
npm run lint
```

Nincs Playwright/Cypress a frontendben. UI: böngésző + fenti checklist.

Egy spec:

```powershell
cd backend
npx jest src/security/token/token.service.spec.ts
```

---

## 17.13 Build

```powershell
cd backend
npm run build
# start:prod = node dist/main  — ugyanaz a .env kell, és szabad 3200

cd ..\frontend
npm run build
npm run start
```

Éles: `NODE_ENV=production` → `REDIS_URL` + `BOOTSTRAP_ADMIN_EMAIL` (nem `admin@admin.com`) + erős titkok. Deploy: [14-deploy.md](./14-deploy.md).

---

## 17.14 Új funkció menete

1. Prisma séma / migráció, ha kell adat (`npx prisma migrate dev --name ...`)
2. Nest: `backend/src/<feature>/` module + service + **DTO** (`dto/bodies.ts` vagy feature dto) minden POST/PUT/PATCH JSON-ra
3. Guard: JWT / EmailVerified / Admin / StreamerApproved
4. `AppModule` import
5. Frontend: `app/.../page.tsx`, hívás `apiFetch` (credentials + CSRF automatikus)
6. Magyar hibaszöveg a API-n
7. Böngésző: happy path + 401/403 + extra body mező 400
8. Frissítsd `02-api.md` / `03-adatbazis.md` / ezt a fájlt, ha a tesztfolyamat változik

Ne vezess be második ORM-ot. Ne szolgálj ki fájlt `uploads/` alól intercept nélkül.

Kódstílus: [06-kodstilus.md](./06-kodstilus.md).

---

## 17.15 Gyakori hibák

| Tünet | Ok | Teendő |
|-------|-----|--------|
| `JWT_SECRET kötelező` | üres `.env` | töltsd ki, indítsd újra |
| `STREAM_SECRET kötelező` | ugyanaz | |
| `EADDRINUSE :3200` / `:3000` | két process | `taskkill` a LISTENING PID-re |
| Nest feláll, de listen hiba | régi `node dist/main` | lásd fent |
| Frontend API hiba | backend nem fut / rossz rewrite | 3200 health |
| 403 CSRF | Postman header nélkül | `X-CSRF-Token` + cookie |
| 400 whitelist | extra JSON mező | DTO szerinti body |
| 403 email | nincs verify | outbox link vagy SQL `emailVerified` |
| HLS 403 | nincs jegy, lejárt süti, más IP | token generate + cookie, same origin `/output` |
| Kép 403 | régi `/uploads` URL | API JSON-ból signed `/media` |
| Admin 403 | nem bootstrap email és nem `role=admin` | SQL vagy újra regisztrálj `admin@admin.com`-mal **devben** |
| Prisma EPERM Windows | zárolt generate | zárd a Node-okat, `prisma generate` |
| Hydration mismatch | bővítmény / nonce | devben gyakran extension; `suppressHydrationWarning` a layouton |

---

## 17.16 Smoke (10 perc, ha a stack megy)

1. `GET http://127.0.0.1:3200/health` → 200  
2. `http://localhost:3000` → főoldal  
3. Login bootstrap admin  
4. `/admin/shows` lista  
5. `/shows` → egy műsor  
6. Dev pay jegy (ha van ár)  
7. `/live/[id]` — 403 vagy player, jegy függvényében  
8. `npm test` a backendben — zöld  

---

## 17.17 További dokumentumok

| Téma | Fájl |
|------|------|
| Architektúra | [01-architektura.md](./01-architektura.md) |
| HTTP API | [02-api.md](./02-api.md) |
| Adatbázis | [03-adatbazis.md](./03-adatbazis.md) |
| Modulok | [04-modulok.md](./04-modulok.md) |
| Telepítés (rövid) | [05-telepites.md](./05-telepites.md) |
| Jogosultság | [07-jogosultsagok.md](./07-jogosultsagok.md) |
| Streaming / FFmpeg | [13-streaming.md](./13-streaming.md) |
| Biztonság | [15-security.md](./15-security.md) |
| Index | [README.md](./README.md) |
