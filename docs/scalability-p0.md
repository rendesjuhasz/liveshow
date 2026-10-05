# P0 scalability (launch pack)

Implemented 2026-09-08. Not a load test. Baseline from the capacity analysis: **one live show**, dual x264, Nest origin HLS, **2 vCPU ≈ 25 viewers**, **4 vCPU ≈ 50**.

## Capacity

| Host | Before (concurrent viewers) | After P0 (estimate) |
|------|-----------------------------|---------------------|
| 2 vCPU / 4 GB | 15–25 | **45–60** |
| 4 vCPU / 8 GB, 1 Gbit | 40–60 | **80–110** |
| Same office NAT | ~8–12 (HLS 600 req/min/IP) | **dozens–100+** until the IP abuse cap (12 000 req/min) |

CPU (one 720p30 show, engineering estimate, not `perf`):

| Stage | Before | After |
|-------|--------|--------|
| Live video encode | 2× libx264 veryfast (~1.5–2 cores) | **1×** libx264, `-threads 2` (~0.5–1 core) |
| Recording | second encode | **tee copy** of the same bitstream |
| Nest / Nginx | starved when FFmpeg took both cores | FFmpeg `PRIORITY_BELOW_NORMAL` + thread cap |

Percentages do **not** multiply. After P0 the usual limiter is **origin NIC/TLS** (~2.5 Mbit/s × N) and still **one Nest fork**.

## Remaining bottlenecks (not in this pack)

- No CDN; Nest `sendFile` for `.ts`
- Playlist GET still hits Prisma `markLive` every ~2 s × viewers
- Dual live shows / archive remux overlapping ingest
- PM2 `instances: 1` (UDP ingest is not cluster-safe)
- `hls_time 2` request rate
- Backup I/O during a show

## Changed files

| File | Change |
|------|--------|
| `ecosystem.config.js` | `liveshow-api` `max_memory_restart: 1024M`; still `instances: 1`, `fork`. Web stays 512M |
| `backend/src/ingest/ingest-ffmpeg.ts` | 720p30, `maxrate 2500k` / `bufsize 5000k`, `-threads 2`, tee HLS+recording, `os.setPriority` |
| `backend/src/ingest/ingest.service.ts` | uses the shared argv; FFmpeg `cwd` = stream output dir |
| `backend/src/security/rate-limit.ts` | HLS per `userId` (900/min) + IP abuse 12 000/min |
| `backend/src/ingest/ingest-ffmpeg.spec.ts` | argv contract |
| `backend/src/ingest/ingest-ffmpeg.live.spec.ts` | ffmpeg HLS + recording + `generateArchive` |
| `backend/src/security/rate-limit.spec.ts` | NAT vs per-viewer |
| `backend/src/security/token/token.service.spec.ts` | HMAC still bound to `userId` (ticket URL) |
| `docs/14-deploy.md`, `docs/13-streaming.md`, `docs/15-security.md`, `MONITORING.md`, `DISASTER_RECOVERY.md` | match the code |

Ticket-gated viewing is unchanged: `GET /token/generate` still runs `assertCanWatch`; HLS URLs still require a valid HMAC (`token` + `expiresAt` + `userId`). Rate limits no longer 429 a whole NAT when each viewer has their own `userId`.

## OBS

Send 720p30 (or higher; the server downscales). Target ≤ 2500 kbps video. Higher OBS bitrates are re-encoded and capped; they still cost decode CPU.
