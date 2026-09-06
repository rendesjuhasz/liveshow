# 5. Telepítési útmutató

A repóban **nincs Dockerfile / docker-compose**. PostgreSQL-t helyben vagy saját konténerrel kell futtatni.

---

## 5.1 Szükséges programok

| Eszköz | Megjegyzés |
|--------|------------|
| Node.js 20+ (LTS) | frontend Next 16, backend Nest 11 |
| npm | |
| PostgreSQL 14+ | adatbázis `streaming` (vagy a `DATABASE_URL` szerinti név) |
| FFmpeg | PATH-on, élő ingest és archív |
| Git | |

Opcionális: Stripe / SMTP / Barion merchant — fejlesztéshez nem kötelező.

---

## 5.2 Adatbázis

Példa helyi URL (jelszót cseréld):

```
postgresql://USER:PASSWORD@localhost:5432/streaming?schema=public
```

Hozd létre az adatbázist, majd a backend könyvtárból:

```powershell
cd backend
npm install
npx prisma migrate deploy
npx prisma generate
```

---

## 5.3 Környezeti változók (`backend/.env`)

| Változó | Kötelező | Jelentés |
|---------|----------|----------|
| `DATABASE_URL` | igen | Prisma |
| `PORT` | nem | default `3200` |
| `FRONTEND_URL` | ajánlott | e-mail linkek, Stripe/Barion return; pl. `http://localhost:3000` |
| `BACKEND_URL` | Barionhoz | webhook URL bázis; pl. `http://127.0.0.1:3200` |
| `ADMIN_EMAIL` | kapcsolat | admin értesítés; fallback `CONTACT_EMAIL` |
| `STREAM_SECRET` | ajánlott | HLS token; default `dev-secret` |
| `STRIPE_SECRET_KEY` | Stripe | ha ki van töltve, fizetős jegy **először Stripe** |
| `BARION_ENABLED` | Barion | csak `true` kapcsolja be |
| `BARION_POS_KEY` | Barion | |
| `BARION_PAYEE` | Barion | |
| `BARION_ENV` | nem | `test` / `prod`, default test |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | e-mail küldés | hiányában csak outbox fájl + EmailLog `logged` |
| `SMTP_PORT` | nem | default 587 |
| `SMTP_SECURE` | nem | `true` = TLS 465 jelleg |
| `MAIL_FROM` | nem | default SMTP user |

**Nincs** `JWT_SECRET` env: a titok `auth.module.ts`-ben `secret123`. Éles előtt env-re kell vinni.

JWT / CORS: a backend csak `http://localhost:3000` és `http://127.0.0.1:3000` origin-t enged.

Frontend: `frontend/api/http.ts` **beégetett** `API_URL = http://127.0.0.1:3200` — nincs `.env` a Next appban.

---

## 5.4 Futtatás (fejlesztés)

Két terminál:

```powershell
cd backend
npm run start:dev
```

```powershell
cd frontend
npm install
npm run dev
```

- API: http://127.0.0.1:3200  
- UI: http://localhost:3000  

Első admin: regisztráld / használd a bootstrap emailt `admin@admin.com` (lásd auth role).

---

## 5.5 Build (produkciós jellegű)

```powershell
cd backend
npm run build
npm run start:prod
```

```powershell
cd frontend
npm run build
npm run start
```

A frontend `start` továbbra is a beégetett `API_URL`-t hívja, hacsak a kódot nem módosítod.

Teljes env lista: [12-env.md](./12-env.md). VPS / Nginx: [11-infra.md](./11-infra.md). Éles lépések: [14-deploy.md](./14-deploy.md).

---

## 5.6 Docker

Nincs projekt-szintű compose. Saját PostgreSQL konténer példa (nem a repo része):

```powershell
docker run --name liveshow-pg -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=streaming -p 5432:5432 -d postgres:16
```

Utána `DATABASE_URL` + Prisma migrate. Az API-t és a Nextet továbbra is Node-dal futtasd, vagy írj saját Dockerfile-t (jelenleg nincs).

---

## 5.7 Teszt

Backend:

```powershell
cd backend
npm test
npm run test:e2e
```

A lefedettség nem teljes; e2e config: `backend/test/jest-e2e.json`.

Frontend: `npm run lint`.

---

## 5.8 Gyakori hibák

| Tünet | Teendő |
|-------|--------|
| Frontend: backend nem elérhető | `start:dev` 3200-on |
| Prisma EPERM generate (Windows) | zárj más Node folyamatot, futtasd újra `prisma generate` |
| HLS 404 | ingest + FFmpeg, létező output path |
| CORS | UI-t 3000-en nyisd, ne más portról |
| Barion nem indul | Stripe elsőbbség, vagy `BARION_ENABLED` nem true |
