# 6. Kódstílus és fejlesztési szabályok

A kódbázis **nem egységes** (van `;` és nincs, van `'` és `"`). Az alábbi a **célállapot** új kódhoz, plusz a tényleges lint toolok.

---

## 6.1 Naming convention

| Elem | Szabály | Példa |
|------|---------|--------|
| Nest fájl | kebab-case + szerep | `tickets.service.ts`, `admin.guard.ts` |
| Osztály | PascalCase | `TicketsService` |
| Metódus / változó | camelCase | `listMine`, `showId` |
| Prisma model | PascalCase | `GiftCampaign` |
| DB map | snake ha `@@map` | `contact_messages`, `faqs` |
| HTTP path | kebab / resource | `/ticket-categories`, `/admin/payouts` |
| Env | SCREAMING_SNAKE | `DATABASE_URL` |
| User role string | kisbetű | `admin`, `moderator` |
| Frontend route | App Router mappa | `app/admin/campaigns/page.tsx` |
| React komponens | PascalCase fájl vagy `page.tsx` | |

Magyar UI szöveg a frontendben; API hibák gyakran magyar `BadRequestException` üzenetek. Új API maradjon következetesen magyar vagy angol — **ne keverj egy végponton**.

---

## 6.2 Fájlstruktúra

```
Streaming Platform/
  backend/src/<feature>/
    *.module.ts
    *.controller.ts
    *.service.ts
    *.guard.ts          # ha kell
  backend/prisma/schema.prisma
  backend/prisma/migrations/
  frontend/app/         # route-ok
  frontend/api/         # HTTP kliens
  frontend/context/     # Auth
  docs/                 # ez a csomag
```

Új backend funkció: saját mappa + import az `app.module.ts`-be. Ne rakj üzleti logikát a controllerbe, ha már van service minta.

Frontend: egy `page.tsx` = egy route. Közös fetch: `frontend/api/http.ts`.

---

## 6.3 Linting és formázás

**Backend** (`backend/eslint.config.mjs`):

- ESLint recommended + typescript-eslint type-checked
- Prettier plugin (`endOfLine: auto`)
- `no-explicit-any`: **off**
- floating promises / unsafe argument: **warn**

```powershell
cd backend
npm run lint
npm run format
```

**Frontend:**

```powershell
cd frontend
npm run lint
```

`eslint-config-next`. Nincs Prettier script a frontend `package.json`-ban.

Új kód: TypeScript strict a projekt tsconfig szerint; kerüld az indokolatlan `any`-t (a lint ezt nem kényszeríti).

---

## 6.4 Commit szabályok

Nincs enforced conventional-commits hook. Ajánlott:

```
<típus>: <rövid magyar vagy angol miért>

Példa: feat: ajándék kampány admin API
       fix: HLS token lejárat query
       docs: kifizetési dokumentáció
```

Típusok: `feat`, `fix`, `docs`, `refactor`, `chore`, `test`.

- Egy commit = egy logikai változás.
- Ne commitolj `.env`, kulcsokat, `node_modules`, HLS kimenetet, `mail-outbox` tartalmat.
- Ne használd a `--no-verify` kapcsolót, hacsak a csapat nem kéri.

---

## 6.5 Pull request szabályok

1. PR leírás: mit, miért, hogyan tesztelted (UI route + API).
2. Érintett `docs/*.md` frissítése, ha API/tábla/modul változott.
3. Migráció a PR-ben, ha séma változott (`prisma migrate`).
4. Ne keverj formázási-only diffet feature-rel.
5. Review: auth (guard), pénz (jegy/payout), stream token.
6. Target branch: a csapat `main` / `master` megegyezése szerint.
7. CI: jelenleg nincs kötelező GitHub Actions a doksiban — ha lesz, a PR-nek zöldnek kell lennie.

---

## 6.6 Tesztelés elvárás

- Új pénz / auth / payout logikához unit vagy service teszt (`*.spec.ts` a `backend/src` alatt, Jest).
- UI: böngészőben a megváltozott route (login, vásárlás, admin).

---

## 6.7 Biztonsági minimum új kódnál

- Admin/moderator végpont: `JwtAuthGuard` + megfelelő Guard.
- Ne logolj jelszót, Stripe/Barion titkot.
- JWT secret ne maradjon hardcoded élesben.
