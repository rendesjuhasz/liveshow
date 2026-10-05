# AI Safety Alerts

15 másodpercenként mintavétel élő `Show.live` műsorokra: FFmpeg stderr (FPS, bitrate, drop, speed), HLS playlist kor, ingest folyamat, nézőszám-trend, chat, jegyek, ismétlődő kérdések, CPU/RAM, DB ping.

Szintek: `info` / `warning` / `critical`. Trend: 10 perces CPU-emelkedés, nézőszám-kapacitás.

## API

| | |
|--|--|
| GET | `/alerts?showId=&status=active\|resolved&severity=` |
| GET | `/alerts/history?...` |
| POST | `/alerts/:id/dismiss` |
| POST | `/alerts/:id/snooze` `{ minutes: 5 }` |
| GET/PUT | `/alerts/settings` email / Discord / Telegram / push |

Socket.IO: `alerts:join` `{ showId }` → esemény `safety-alert`.

UI: `/streamer/live` lebegő panel (mobil: nagy gombok, safe-area), `/streamer/alerts` előzmény + szűrők.

Migráció: `20260909190000_stream_alerts`.
