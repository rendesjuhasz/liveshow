# 9. Kifizetési rendszer

A platform **jegybevételt** számol, **jutalékot** von, a maradékot a streamer **kérelmezheti**. A tényleges banki / Barion kifizetés **nincs automatizálva**: az admin `approved` → `paid` státusz manuális (utalás a platformon kívül).

Ez **nem** a néző jegyfizetése (az a Payments / Stripe / Barion / dev). Itt a streamer oldali **Payout** entitás.

---

## 9.1 Bevételszámítás

Forrás: `computeStreamerRevenue` (`backend/src/payouts/revenue.ts`).

1. A streamer összes `Show` rekordja.
2. Jegyek, ahol `showId` ezek közül van **és** `status ∈ { paid, active }`.
3. **Bruttó** = jegyek `price` összege (Ft, egész).
4. Platform jutalék % a `PlatformConfig` sorból (`id = 'default'`), default **20**.
5. `splitRevenue`:  
   `commission = round(gross * rate / 100)`  
   `net = gross - commission`  
   rate clamp **0–90**.

Műsoronként ugyanígy részösszeg a dashboard `shows[]` tömbben.

**Nem számít:** `pending` / `failed` / `cancelled` / `used` jegy (a used jelenleg nincs a fulfiled listában — csak paid és active).

---

## 9.2 Elérhető egyenleg (`available`)

```
reserved = Σ pending Payout + Σ approved + Σ paid
available = max(0, net - reserved)
```

Tehát a **már kifizetett** és a **folyamatban lévő** kérelmek is foglalják a nettót. Nincs külön „ledger” tábla; a Payout sorok az egyetlen foglalás.

---

## 9.3 Minimum összeg és időzítés

| Szabály | Jelenlegi kód |
|---------|----------------|
| Minimum kifizetés | **nincs** küszöb (pl. nincs 10 000 Ft) |
| Összeg | `amount` egész, **> 0**, **≤ available** |
| Automatikus ütemezés | **nincs** (nincs havi cron) |
| Pénznem | Ft, integer |

Streamer: `POST /streamer/payouts` `{ amount }`.  
Admin is létrehozhat: `POST /admin/payouts` `{ streamerId, amount }` (ugyanaz az available check a service-ben).

400: „Pozitív összeg kell.” / „Maximum {available} Ft…”

---

## 9.4 Folyamat

```
Streamer kérelem          Admin
     │                      │
     ▼                      ▼
Payout status=pending  →  POST .../approve  → status=approved
                          (email payout_approved)
                          POST .../paid     → status=paid
```

`PATCH /admin/payouts/:id` `{ status }` tetszőleges érvényes státuszra (`pending` \| `approved` \| `paid`).

**Nincs** `rejected` státusz a `PAYOUT_STATUSES` listában. Elutasítás: ne approve-old, vagy később bővítsd a sémát.

SQL migráció hozzáadhatott `reviewedAt` / `paidAt` oszlopokat; a Prisma `Payout` modell ezeket **nem** map-eli — a státusz a forrás.

---

## 9.5 Jutalék adminisztráció

- Olvasás: `GET /admin/commission` → `{ commissionPercent }`
- Írás: `PUT /admin/commission` `{ percent }` vagy `{ commissionPercent }`
- Tárolás: `PlatformConfig.commissionPercent`
- A **már eladott** jegyek bruttója a **aktuális** %-kal számolódik újra (nincs historikus jutalék a jegyhez). Élesben ez azt jelenti: % váltás visszamenőlegesen változtatja a nettót.

---

## 9.6 Hibakezelés

| Helyzet | Viselkedés |
|---------|------------|
| Nincs available | 400, kérelem nem jön létre |
| Streamer nem approved | 403 a `/streamer/*` gárddal |
| Approve | email; SMTP hiba nem rollbackeli a státuszt |
| Dupla kifizetés | reserved tartalmazza a paid-et, available csökken; nincs idempotens payment ID a bank felé |
| Jegy visszatérítés | **nincs** payout recalculation hook; manuális admin teher |

---

## 9.7 Kapcsolat a nézői fizetéssel

| Néző | Streamer |
|------|----------|
| Stripe / Barion / `confirm-dev` | Payout rekord |
| Ticket + Payment | nincs Payment a Payout-hoz |
| `GET /payments` admin lista | `GET /admin/payouts` |

A streamer nettója **nem** Stripe Connect / Barion kifizetés. A platform összegyűjti a jegypénzt, a kifizetés könyvelése belső.

---

## 9.8 Érintett fájlok

- `backend/src/payouts/*`
- `streamer-dashboard.service.ts` `requestPayout`, `getRevenue`
- `streamers.service.ts` admin payout
- `admin.service.ts` stats split
- Frontend: `/streamer/payouts`, `/streamer/revenue`, admin streamer profil
