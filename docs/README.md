# LiveShow – Fejlesztői dokumentációs csomag

Ez a mappa a streaming / jegyértékesítő platform **átvételéhez és továbbfejlesztéséhez** készült. A leírások a jelenlegi kódbázist tükrözik (NestJS backend + Next.js frontend + PostgreSQL), nem egy tervezett ideális architektúrát.

| # | Dokumentum | Tartalom |
|---|------------|----------|
| 1 | [01-architektura.md](./01-architektura.md) | Rendszerfelépítés, adatáramlás, külső API-k |
| 2 | [02-api.md](./02-api.md) | HTTP / WebSocket végpontok |
| 3 | [03-adatbazis.md](./03-adatbazis.md) | Táblák, kapcsolatok, migrációk |
| 4 | [04-modulok.md](./04-modulok.md) | Stream, feed, értesítés, kifizetés, moderáció, onboarding |
| 5 | [05-telepites.md](./05-telepites.md) | Fejlesztői környezet, env, futtatás |
| 6 | [06-kodstilus.md](./06-kodstilus.md) | Naming, struktúra, lint, PR |
| 7 | [07-jogosultsagok.md](./07-jogosultsagok.md) | Szerepek és API-hozzáférés |
| 8 | [08-esemenyek-ertesitesek.md](./08-esemenyek-ertesitesek.md) | Trigger, email, nincs külön queue |
| 9 | [09-kifizetes.md](./09-kifizetes.md) | Jegybevétel, jutalék, payout |
| 10 | [10-fejlesztoi-utmutato.md](./10-fejlesztoi-utmutato.md) | Gyors belépő, új modul, deploy |
| 11 | [11-infra.md](./11-infra.md) | VPS, domain, Nginx, SSL, backup, logok |
| 12 | [12-env.md](./12-env.md) | Minden környezeti változó |
| 13 | [13-streaming.md](./13-streaming.md) | Ingest, streamId, HLS, FFmpeg, archív, fájlok |
| 14 | [14-deploy.md](./14-deploy.md) | git pull → migrate → build → PM2, rollback |
| 15 | [15-security.md](./15-security.md) | Jelenlegi kockázatok és P0 javítások |
| 16 | [16-roadmap.md](./16-roadmap.md) | Kész / részben / tervezett |

**Stack röviden**

- Frontend: Next.js 16, React 19, Tailwind, `http://localhost:3000`
- Backend: NestJS 11, Prisma, PostgreSQL, `http://127.0.0.1:3200` (nincs globális `/api` prefix, kivéve néhány explicit útvonalat)
- Auth: JWT, `Authorization: Bearer <token>`, titok jelenleg `secret123`, lejárat 7 nap
- Bootstrap admin: `admin@admin.com`

A dokumentációt a kóddal együtt kell karbantartani: új végpont / tábla / modul esetén frissítsd a megfelelő fájlt.
