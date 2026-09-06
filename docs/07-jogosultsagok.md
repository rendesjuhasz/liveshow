# 7. Jogosultsági rendszer

Két tengely: **User.role** + **User.status**, és streamereknél külön **Streamer.status**. A jegy a streamhez külön kapu.

Forrás: `backend/src/auth/roles.ts`, guardok: `JwtAuthGuard`, `AdminGuard`, `ModeratorGuard`, `StreamerApprovedGuard`.

---

## 7.1 Szerepek (`User.role`)

| role | Jelentés |
|------|----------|
| `user` | néző (alapértelmezett regisztráció) |
| `streamer` | user, akinek streamer onboardingje van; a dashboardhoz **Streamer.approved** kell |
| `moderator` | kérdések, értékelések, banned words |
| `admin` | minden admin API |

**Bootstrap:** ha az email `admin@admin.com`, a user **admin**, a role mezőtől függetlenül (`isAdminRole`).

**Moderator:** `isModeratorRole` = admin **vagy** `role === moderator`. Tehát az admin mindent moderálhat.

**isStreamerRole:** admin vagy role streamer — ez **nem** helyettesíti a `StreamerApprovedGuard`-ot.

---

## 7.2 User.status

| status | Hatás |
|--------|--------|
| `active` | beléphet |
| `banned` | admin tiltás; login / használat a service szerint korlátozott |

Admin: `PATCH /admin/users/:id/status`, `/ban`, `/activate`. Saját fiók tiltása ellenőrizve van a service-ben (ne tiltsd ki magad).

---

## 7.3 Streamer.status

| status | Dashboard `/streamer/*` | Megjegyzés |
|--------|-------------------------|------------|
| `pending` | 403 | regisztráció után |
| `approved` | OK | `StreamerApprovedGuard` |
| `rejected` | 403 | |
| `banned` | 403 | |

Nyilvános `/streamers` lista a service szerint csak megfelelő státuszúakat mutat.

Admin: approve / reject / ban / activate (`activate` = approved).

---

## 7.4 Guardok és API mátrix

| Feltétel | Guard / szabály |
|----------|-----------------|
| Bejelentkezés | `JwtAuthGuard` — nincs user → 401 |
| Admin | `AdminGuard` — DB-ből user, `isAdminUser` különben 403 |
| Moderátor | `ModeratorGuard` — admin vagy moderator |
| Streamer dashboard | JWT + approved Streamer rekord (userId vagy email egyezés) |
| Opcionális JWT | `OptionalJwtAuthGuard` (értékelés lista) |
| HLS | nem user JWT, hanem `TokenService` query token |
| Ingest start | admin |
| Barion webhook | nincs JWT |
| Kapcsolat POST | nincs JWT |

Részletes végpont–jogosultság: [02-api.md](./02-api.md).

---

## 7.5 Néző (user) mit tehet

- Regisztráció, login, `/auth/me`
- Műsorok, FAQ, archív lista, publikus streamerek
- Jegyvásárlás, saját jegyek
- Érvényes jeggyel `/token/generate` + HLS
- Kérdés küldés, értékelés (pending)
- Kapcsolatűrlap
- **Nem** hívhat `/admin/*`, `/ingest/start`, `/streamer/*` (hacsak nincs approved streamer)

Jegy entitlements (`tickets/entitlements.ts`): kategória (`nezo` / `interaktiv` / `vip`) + `paid`/`active` → kérdezés, extras, stb.

---

## 7.6 Streamer mit tehet

Onboarding után, **approved**:

- Saját műsor CRUD (draft), submit, live
- Bevétel, payout kérelem (amount ≤ available)
- Profil, saját kérdések/értékelések olvasása
- **Nem** admin user-kezelés, globális jutalék, más streamer payout approve

Pending streamer: `/streamers/me` JWT-vel még elérhető lehet; a `/streamer` prefix nem.

---

## 7.7 Moderátor mit tehet

- `/questions/moderation`, audit, review, banned-words
- `/reviews/moderation`, review status
- **Nem** (kivéve ha admin is): payout, commission, user ban, show delete, ingest

Frontend: `/admin/questions`, `/admin/reviews` — a UI-t a role szerint kell szűrni; a **szerver a forrás**.

---

## 7.8 Admin mit tehet

Minden Moderator +:

- Show teljes CRUD, státusz, archív FFmpeg
- User / streamer életciklus
- Jegy ajándék, kampányok, kategóriaárak
- FAQ, contact lista, email napló
- Commission, payout approve/paid, payments lista
- Moderátor role kiosztás `POST /admin/moderators`
- Ingest indítás

---

## 7.9 Show.status vs eladás

| status | Jegyeladás (TICKET_SALE_STATUSES) |
|--------|-----------------------------------|
| active (és a service által engedett) | igen |
| archived / blocked / draft / pending | jellemzően nem |

Pontos lista: `backend/src/shows/show-status.ts`.

---

## 7.10 Frontend kapu

`AuthContext` + localStorage token. Az admin oldalak kliens oldali ellenőrzése **nem biztonsági határ**. Minden érzékeny művelet a backend guardon múlik.
