# 10. Fejlesztői használati útmutató

Cél: az első napon fusson a stack, és tudd, hova nyúlj. Részletek: a többi `docs/0*.md`.

---

## 10.1 Gyors start

1. PostgreSQL + `DATABASE_URL`
2. `cd backend` → `npm install` → `npx prisma migrate deploy` → `npx prisma generate` → `npm run start:dev`
3. `cd frontend` → `npm install` → `npm run dev`
4. Böngésző: http://localhost:3000  
5. Admin: user `admin@admin.com` (bootstrap), vagy szerep `admin` az adatbázisban

Részletes env: [12-env.md](./12-env.md), telepítés: [05-telepites.md](./05-telepites.md). Streaming: [13-streaming.md](./13-streaming.md).

---

## 10.2 Fontos fájlok

| Fájl | Miért |
|------|--------|
| `backend/src/app.module.ts` | modul lista |
| `backend/src/main.ts` | port 3200, CORS, `/uploads` |
| `backend/prisma/schema.prisma` | adatmodell |
| `backend/src/auth/auth.module.ts` | JWT secret |
| `backend/src/auth/roles.ts` | szerepek |
| `frontend/api/http.ts` | API_URL, Bearer |
| `frontend/context/AuthContext.tsx` | session |
| `backend/src/tickets/tickets.service.ts` | vásárlás + hozzáférés |
| `backend/src/payouts/revenue.ts` | pénz |
| `backend/src/mail/mail.service.ts` | emailek |
| `docs/README.md` | dokumentum index |

---

## 10.3 Futtatás és teszt

| Feladat | Parancs |
|---------|---------|
| API watch | `backend`: `npm run start:dev` |
| UI | `frontend`: `npm run dev` |
| Backend unit | `npm test` |
| Backend e2e | `npm run test:e2e` |
| Lint BE | `npm run lint` |
| Lint FE | `npm run lint` |
| Prod build | `npm run build` mindkét oldalon |

Manuális smoke: login → `/shows` → jegy (dev pay) → `/live/:id` → admin `/admin/shows`.

---

## 10.4 Deploy (jelenlegi valóság)

Lépésről lépésre + rollback: [14-deploy.md](./14-deploy.md). Infra sablon: [11-infra.md](./11-infra.md). Nincs K8s / Docker / CI a gitben. Minimális éles checklist:

1. PostgreSQL managed + `migrate deploy`
2. Backend Node process (`nest build` / `node dist/main`), `PORT`, `DATABASE_URL`, titkok
3. Frontend `next build` + `start`; **cseréld** az `API_URL`-t és a CORS origin listát
4. JWT secret env-re
5. HTTPS reverse proxy
6. FFmpeg a stream hoston, tartós HLS volume
7. SMTP élesben; ne hagyatkozz az outbox fájlra
8. Stripe webhook / Barion IPN publikus `BACKEND_URL`

---

## 10.5 Új modul menete

1. **Terv:** melyik docs fájl változik (API, DB, jogosultság).
2. **Prisma:** mezők → `migrate dev` → `03-adatbazis.md`.
3. **Nest:** `backend/src/my-feature/` module + service + controller. Guard, ha nem publikus.
4. **AppModule** `imports`.
5. **Frontend:** `app/.../page.tsx` + `api/http.ts` helper.
6. **Mail / payout / stream:** ne másold a logikát, hívd a meglévő service-t.
7. **Ellenőrzés:** böngésző a megváltozott route-on; 401/403 a guardon.
8. **Dokumentáció:** `02-api.md` táblázat + `04-modulok.md` ha új termékmodul.

Példa Nest váz:

```ts
@Module({ imports: [PrismaModule], controllers: [XController], providers: [XService] })
export class XModule {}
```

Ne vezess be második ORM-ot (Drizzle a függőségekben legacy).

---

## 10.6 Ismert csapdák

- Nincs globális `/api` prefix — a frontend path-ok ` /shows`, nem `/api/shows` (kivéve contact/barion).
- Stripe megelőzi a Bariont, ha van secret.
- HLS 403 nem JSON.
- WebRTC minden peernek megy.
- `ChatMessage` tábla API nélkül.
- `frontend_clean` mappa lehet régi másolat — a futó app a `frontend/`.
- Jutalék % váltás visszamenőleges a nettó számításban.

---

## 10.7 Hol kérdezz a kódtól

| Kérdés | Keresés |
|--------|---------|
| Ki hívhatja? | `@UseGuards` a controllerben |
| Mi a jegy aktív? | `isTicketActive` |
| Mennyi a nettó? | `computeStreamerRevenue` |
| Milyen email megy? | `MAIL_TYPES` + `MailService` |
| Hol a HLS fájl? | `streaming/hls-paths.ts` |
