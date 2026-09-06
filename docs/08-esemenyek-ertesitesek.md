# 8. Event és értesítési rendszer

**Nincs** külön event bus, Redis, Bull, RabbitMQ vagy worker process. Minden szinkron a Nest requestben, vagy egy **in-process `setInterval` (60 s)** az élő emlékeztetőkre.

„Queue”: `MailService.queue` → azonnal `dispatch` (fire-and-forget `.catch`). Deduplikáció az `EmailLog` táblán (type + toEmail + relatedId).

---

## 8.1 Futás modell

```
HTTP handler / guard utáni service
        │
        ▼
MailService.queue()  ──► SMTP ha SMTP_* ki van töltve
                      ──► mindig: backend/mail-outbox/*.html (ha a write sikerül)
                      ──► EmailLog status: sent | logged
```

SMTP hiányában a levél **nem megy ki** a felhasználónak, de a napló `logged` és a fájl megmarad.

Admin UI: `GET /admin/emails` → `/admin/emails`.

---

## 8.2 Email típusok (`MAIL_TYPES`)

| type | Trigger | relatedId tipikusan |
|------|---------|---------------------|
| `registration` | sikeres register / register-streamer | email |
| `ticket_purchased` | jegy `paid`/`active` lesz | ticket id |
| `live_reminder` | timer: műsor startTime a [most−15p, most+60p] ablakban, érvényes jegy | `showId:userId` |
| `archive_ready` | archív generálás kész | show/archive |
| `streamer_approved` | admin approved streamer | streamer id |
| `payout_approved` | admin approve payout | payout id |
| `contact_admin` | kapcsolatűrlap → ADMIN_EMAIL | message id |
| `contact_user` | kapcsolatűrlap visszaigazolás a feladónak | message id |

Sablonok: `backend/src/mail/mail.templates.ts` (tárgy prefix: `LiveShow · …`). Linkek: `FRONTEND_URL`.

---

## 8.3 Trigger-ek kódban

| Esemény | Hol | Értesítés |
|---------|-----|-----------|
| Néző / streamer regisztráció | `auth.service` | `mail.registration` |
| Jegy teljesítve (fizetés / ajándék / kampány) | `tickets.service` / payments confirm | `mail.ticketPurchased` |
| Streamer approved | `admin-users.service` / streamers setStatus | `mail.streamerApproved` |
| Payout approved | `streamers.service.approvePayout` | `mail.payoutApproved` |
| Archív kész | `archive.service` | `mail.archiveReady` |
| Kapcsolat | `contact.service` | admin + user email |
| Élő emlékeztető | `MailService.onModuleInit` interval | `live_reminder` |

A live reminder **minden 60 másodpercben** újra lekérdezi a műsorokat; a dedupe megakadályozza az ismételt küldést ugyanarra a `showId:userId` párra.

---

## 8.4 Nem e-mail „események”

| Esemény | Mechanizmus | Tartós tárolás |
|---------|-------------|----------------|
| Nézettség | `ViewLogService.record` token generate / archive GET / HLS playlist | `ViewEvent` |
| Élő nézők | `LiveViewTracker` HLS playlist kéréskor | memória (nem DB queue) |
| Kérdés státusz | QuestionAudit sor | `QuestionAudit` |
| WebRTC | Socket.IO broadcast | nincs |
| Jegy / payout státusz | Prisma update | Ticket, Payment, Payout |

Nincs domain event tábla (`Outbox` / `Event`). Ha aszinkron workert akarsz, új infrastruktúra kell.

---

## 8.5 Hibakezelés

- SMTP hiba: log `warn`, EmailLog `logged`, a request **nem** dől el (queue catch).
- Érvénytelen cím: `dispatch` return.
- Duplikátum: csendben skip.
- Timer hiba: `Emlékeztető hiba` warn, a folyamat él.

---

## 8.6 Új értesítés hozzáadása

1. Típus a `MAIL_TYPES` + sablon függvény.
2. `MailService` publikus metódus.
3. Hívás a megfelelő service-ből (ne a controllerből, ha van service).
4. `relatedId` legyen stabil a dedupéhoz.
5. Frissítsd ezt a dokumentumot és az admin email típus szűrőt, ha van UI.
