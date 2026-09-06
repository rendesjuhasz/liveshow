# 12. Környezeti változók

A backend `dotenv` a `backend/.env`-et tölti (`main.ts` → `import "dotenv/config"`). A fájl **gitignore**-olt.

A frontend API címe: `NEXT_PUBLIC_API_URL` vagy default `http://127.0.0.1:3200`.

**JWT:** a rendszer olvassa a `JWT_SECRET` változót. Élesben (`NODE_ENV=production`) kötelező. Fejlesztésben hiány esetén ideiglenes fallback: `secret123`.

---

## 12.1 Teljes lista

```env
# --- kötelező ---
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/streaming?schema=public

# --- HTTP ---
PORT=3200
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://127.0.0.1:3200

# --- auth (CÉL; ma nem használt) ---
JWT_SECRET=
ALLOW_DEV_PAY=
BOOTSTRAP_ADMIN_EMAIL=admin@admin.com
STREAM_SECRET=

# --- HLS / stream token (nem a user JWT) ---
STREAM_SECRET=dev-secret

# --- e-mail ---
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
ADMIN_EMAIL=
CONTACT_EMAIL=

# --- Stripe (ha ki van töltve, fizetős jegy ELŐSZÖR Stripe) ---
STRIPE_SECRET_KEY=

# --- Barion (csak ha BARION_ENABLED=true ÉS POS+payee, ÉS nincs Stripe secret) ---
BARION_ENABLED=false
BARION_POS_KEY=
BARION_PAYEE=
BARION_ENV=test
```

---

## 12.2 Magyarázat

| Változó | Használja? | Hol | Mire |
|---------|------------|-----|------|
| `DATABASE_URL` | igen | Prisma, `backend/src/db/index.ts` (Drizzle legacy) | Postgres kapcsolat |
| `PORT` | igen | `main.ts` | API listen, default `3200`, host `0.0.0.0` |
| `FRONTEND_URL` | igen | mail sablonok, Stripe/Barion return URL | linkek, checkout success/fail (`/payment/success`, `/payment/failed`) |
| `BACKEND_URL` | Barion | `payments.service.ts` | webhook bázis (`/api/barion/webhook`) |
| `JWT_SECRET` | **igen élesben** | `auth/secrets.ts`, `auth.module.ts`, `jwt.strategy.ts` | User JWT. Fejlesztésben hiány esetén ideiglenes `secret123`. |
| `ALLOW_DEV_PAY` | nem | `payments.service.ts` | `true` kényszeríti a tesztfizetést; `false` tiltja. Default: nem production. |
| `BOOTSTRAP_ADMIN_EMAIL` | nem | `auth/roles.ts` | default `admin@admin.com` |
| `NEXT_PUBLIC_API_URL` | frontend | `frontend/api/http.ts` | API bázis, default `http://127.0.0.1:3200` |
| `STREAM_SECRET` | igen | `token.service.ts` | HMAC a HLS `token` query-hez; default `dev-secret` |
| `SMTP_HOST` | igen | `mail.service.ts` | ha HOST+USER+PASS mind megvan → SMTP küldés |
| `SMTP_PORT` | igen | ugyanott | default `587` |
| `SMTP_SECURE` | igen | ugyanott | csak ha értéke a string `true` |
| `SMTP_USER` / `SMTP_PASS` | igen | SMTP auth | hiány → nincs kimenő levél, csak outbox + `EmailLog` `logged` |
| `MAIL_FROM` | igen | `from` header | default: `SMTP_USER` |
| `ADMIN_EMAIL` | igen | `contact.service.ts` | kapcsolatűrlap admin értesítés |
| `CONTACT_EMAIL` | fallback | ugyanott | ha nincs `ADMIN_EMAIL` |
| `STRIPE_SECRET_KEY` | igen | `payments.service.ts` | Checkout Session; **elsőbbség** a Barion előtt |
| `BARION_ENABLED` | igen | `barion.client.ts` | `true` / `1` / `yes` (kisbetű) |
| `BARION_POS_KEY` | igen | Barion Start / state | merchant POS Key |
| `BARION_PAYEE` | igen | fizetés | kedvezményezett e-mail / fiók |
| `BARION_ENV` | igen | API host | `test` (default) vagy `prod` / `production` |

Nem env, de „titok”:

| Hol | Érték |
|-----|--------|
| JWT | `"secret123"`, lejárat `7d` |
| Bootstrap admin | email `admin@admin.com` mindig admin |
| CORS | csak `http://localhost:3000` és `http://127.0.0.1:3000` |

---

## 12.3 Fizetési döntési fa (env)

```
fizetős jegy
  ├─ STRIPE_SECRET_KEY kitöltve? → Stripe Checkout
  ├─ különben BARION_ENABLED + POS + payee? → Barion
  └─ különben → teszt (devPay / confirm-dev)
```

Ingyenes / 0 Ft jegy: nincs gateway.

---

## 12.4 Éles checklist

1. Erős `STREAM_SECRET` (és miután bekötöd: `JWT_SECRET`).
2. `FRONTEND_URL` / `BACKEND_URL` HTTPS domain.
3. `DATABASE_URL` ne `localhost` a VPS-en, ha a Postgres socket/user más.
4. SMTP kitöltve, különben a user nem kap levelet.
5. Stripe **vagy** Barion, ne mindkettő véletlenül (Stripe nyer).
6. Soha ne commitold a `.env`-et. Példaértékek csak itt / titkosított backup.

Kapcsolódó: [05-telepites.md](./05-telepites.md), [15-security.md](./15-security.md).
