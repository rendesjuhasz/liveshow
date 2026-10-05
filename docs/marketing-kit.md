# Marketing Kit + Publish Everywhere

Streamer/admin: műsor szerkesztőoldal, kártya **AI Marketing Kit**.

## API (Nest, böngészőből `/api/...`)

| Method | Path | |
|--------|------|--|
| POST | `/ai/marketing-kit/generate` | `{ streamId, language: "hu"\|"en" }` → `{ marketingKit }` |
| GET | `/ai/marketing-kit/:streamId` | legújabb kit + fiókok + publish státusz |
| GET | `/ai/marketing-kit/:streamId/history` | MarketingKitRun napló |
| PATCH | `/ai/marketing-kit/:kitId` | mezők szerkesztése |
| POST | `/ai/marketing-kit/oauth/:provider/start` | `{ streamId }` → `{ url }` |
| GET | `/ai/marketing-kit/oauth/:provider/callback` | OAuth redirect |
| POST | `/ai/marketing-kit/:kitId/publish` | `{ provider, accountId, mode: now\|schedule, scheduledAt? }` |
| POST | `/ai/marketing-kit/publish/:jobId/retry` | |

`streamId` = **Show.id** (vagy HLS `Show.streamId`). Jogosultság: műsor streamerének `userId`-ja vagy admin.

OpenAI: `OPENAI_API_KEY`, opcionális `OPENAI_MODEL` (default `gpt-4o-mini`). OAuth: `FACEBOOK_*`, `LINKEDIN_*`, `X_*`. Tokenek AES-256-GCM (`MARKETING_TOKEN_SECRET` vagy `JWT_SECRET`).

Callback URL: `{BACKEND_URL}/ai/marketing-kit/oauth/{facebook|linkedin|x}/callback`
