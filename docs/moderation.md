# Moderálás (jelentés + chat)

Launch-minimum a korábbi lyukakra: nézői jelentés, szűrt élő chat, streamer saját sor.

## Jelentés

`POST /reports` `{ targetType, targetId, reason, details? }`

`targetType`: `question` | `review` | `streamer` | `show` | `chat`  
`reason`: `spam` | `harassment` | `illegal` | `off_platform` | `other`

Egy user + cél: egy sor (`@@unique`). E-mail megerősítés kell.

| | |
|--|--|
| GET | `/reports?status=open\|all` | moderátor |
| PATCH | `/reports/:id` `{ status: dismissed\|actioned, note? }` | moderátor |
| GET | `/streamer/reports` | saját műsor / kérdés / értékelés / chat / profil |
| PATCH | `/streamer/reports/:id` | streamer (saját profil elleni jelentést nem zárhatja) |

UI: `ReportButton`, `/admin/reports`, `/streamer/moderation`.

## Chat

Ugyanaz a tiltott szó + spam + off-platform szűrő, mint a kérdéseknél. Ha átmegy: azonnal `approved`. Ha nem: `rejected`, a nézők nem látják. Flood 3 s, max 280 karakter. Csak `Show.live`.

| | |
|--|--|
| GET | `/shows/:showId/chat` |
| POST | `/shows/:showId/chat` `{ text }` |
| GET/PATCH | `/streamer/chat`, `/streamer/chat/:id` |
| GET/PATCH | `/shows/:showId/chat/moderation`, `/chat/:id` | moderátor |

## Streamer kérdés-sor

`GET /streamer/questions/queue` — pending kérdések a saját műsoron.  
`PATCH /streamer/questions/:id/review` `{ status: "rejected" }`.

Migráció: `20260909200000_content_reports_chat_mod`.
