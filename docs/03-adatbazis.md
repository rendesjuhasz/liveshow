# 3. Adatbázis dokumentáció

**Motor:** PostgreSQL  
**ORM:** Prisma (`backend/prisma/schema.prisma`)  
**Kapcsolat:** `DATABASE_URL` a `backend/.env`-ben.

A `package.json`-ban van Drizzle is; **a forrás a Prisma**. Ne keverd a két migrációs rendszert.

---

## 3.1 Migrációk

Könyvtár: `backend/prisma/migrations/`. Alkalmazás:

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

Fejlesztésben: `npx prisma migrate dev` (új változáskor).

| Mappa | Tartalom |
|-------|----------|
| `20260812180404_init` | User, Stream, Show, Recording alap |
| `20260821214157_fix_show_model` | Show mezők |
| `20260822151600` … `22183800` | streamUrl, role, streamId, Ticket |
| `20260822192000_platform_features` | platform funkciók |
| `20260822203000` / `22220000` | streamer regisztráció + státusz |
| `20260822223000` … `22232000` | Review, jegy kategória, VIP extras, kérdés moderáció, user status, show status |
| `20260823083000_payout_commission` | `PlatformConfig`, Payout extra oszlopok |
| `20260823085000_view_events` | `ViewEvent` |
| `20260823090000_review_moderation` | értékelés státusz |
| `20260823095000_email_log` | EmailLog |
| `20260823120000_barion_payment` | Payment.barionPaymentId |
| `20260823140000_gift_campaigns` | GiftCampaign, GiftClaim |
| `20260823150000_contact_messages` | contact_messages |
| `20260823160000_faqs` | faqs |

**Logika:** Prisma migráció a kanonikus séma. Emellett néhány service `CREATE TABLE IF NOT EXISTS`-t futtat indításkor (Windows `prisma generate` EPERM / hiányzó kliens ellen): EmailLog, GiftCampaign, contact, FAQ, PlatformConfig. **Ne támaszkodj csak erre élesben** — futtasd a migrációkat.

---

## 3.2 Prisma modellek

Minden `id` UUID string, hacsak másképp nincs jelezve. Összegek **egész Ft**.

### User
| Mező | Típus | Megjegyzés |
|------|-------|------------|
| id | PK UUID | |
| email | unique | |
| password | bcrypt hash | |
| role | string | `user` \| `admin` \| `moderator` \| `streamer` |
| status | string | `active` \| `banned` |
| createdAt, updatedAt | | |

Kapcsolatok: tickets, payments, questions, reviews, streamer 1:1, chatMessages, streams, giftClaims, questionAudits.

### Streamer
| Mező | Megjegyzés |
|------|------------|
| name, email (unique), bio, avatarUrl, category, contactEmail | |
| userId | unique, nullable — User |
| termsAcceptedAt | |
| status | `pending` \| `approved` \| `rejected` \| `banned` |

→ shows, payouts.

### Stream
Élő ingest meta: `isLive`, `streamKey` unique, `hlsPath`, `rtpPort`, `showId` unique → Show.

### Recording
`streamId`, `fileUrl`, opcionális `showId`.

### Archive
1:1 Show (`showId` unique). `filePath`, `publicPath`, `size`.

### Show
| Mező | Megjegyzés |
|------|------------|
| title, description, image, startTime, price | |
| live, featured | bool |
| streamUrl, streamId, privateStreamId | |
| streamerId | |
| extrasContent | VIP extra |
| status | `draft` \| `pending` \| `active` \| `blocked` \| `archived` |

### Ticket
`@@unique([userId, showId])` — egy user egy műsorra egy jegy.  
`status` lásd jegy dokumentáció. `categoryId` → TicketCategory. `price` a vásárláskori ár.

### GiftCampaign / GiftClaim
Kampány: `type` `first_users` \| `first_buyers`; `status` draft/active/paused/ended; `maxClaims`; `categoryKey` default `nezo`.  
Claim: `source` `admin_gift` \| `first_users` \| `first_buyers`. Index: `(campaignId, userId)`.

### TicketCategory
`key` unique: `nezo`, `interaktiv`, `vip`. `name`, `price`, `sortOrder`.

### ShowTicketOffer
`@@unique([showId, categoryId])` — mely kategóriák vásárolhatók a műsoron.

### Review
`@@unique([userId, showId])`. `rating` int, `status` pending/approved/rejected.

### Payment
`amount`, `status`, `provider` (`dev` / `stripe` / `barion`). `stripeSessionId`, `barionPaymentId` unique nullable.

### Payout
`amount`, `status` pending/approved/paid. SQL-ben lehet `reviewedAt`, `paidAt` (migráció); a Prisma modellben jelenleg **nincs** ezekre mező.

### Question / QuestionAudit / BannedWord
Kérdés: `status` pending/approved/rejected, `filterReason`, `reviewedAt`, `reviewedById`.  
Audit: action, fromStatus, toStatus, note.

### ChatMessage
Show + User + text. **Nincs HTTP API** a jelenlegi kódban (lefoglalt séma).

### EmailLog
type, toEmail, subject, body, relatedId, status (`logged` / `sent`). Deduplikáció: type + toEmail + relatedId.

### ContactMessage → tábla `contact_messages`
name, email, message, created_at.

### Faq → tábla `faqs`
category, question, answer, `order` (Prisma: sortOrder), isPublished.

---

## 3.3 Prisma-n kívüli táblák

### PlatformConfig
`id` = `'default'`, `commissionPercent` INTEGER default 20. Olvasás/írás: `backend/src/payouts/platform-config.ts`.

### ViewEvent
`kind` (`live` / `archive`), opcionális showId, streamId, userId, createdAt.  
Indexek: `(kind, createdAt)`, `(showId, kind)`.

---

## 3.4 Kapcsolati ábra (egyszerűsített)

```
User 1──1 Streamer 1──* Show 1──* Ticket *──1 User
                 │         ├── 1──1 Stream
                 │         ├── 1──1 Archive
                 │         ├── *── TicketCategory (ShowTicketOffer)
                 └── * Payout
Ticket 1──* Payment
Show 1──* Question 1──* QuestionAudit
Show 1──* Review
Show 1──* GiftCampaign 1──* GiftClaim ── Ticket, User
```

---

## 3.5 Indexek és kulcsok (Prisma / SQL)

- Unique: User.email, Streamer.email, Streamer.userId, Stream.streamKey, Stream.showId, Archive.showId, Ticket (userId, showId), TicketCategory.key, ShowTicketOffer (showId, categoryId), Review (userId, showId), Payment stripe/barion session id-k, BannedWord.word, GiftClaim index campaign+user.
- FK: Prisma `@relation` + `onDelete: Cascade` Ticket/Show, GiftCampaign/Show, stb. Stream.user `onDelete: Restrict`.

Új mező: először `schema.prisma`, aztán `prisma migrate dev`, majd dokumentáld itt.
