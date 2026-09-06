# 13. Streaming dokumentáció

Ez a platform legösszetettebb, legnehezebben visszafejthető része. A leírás a **mai kódot** követi, nem egy ideális CDN/RTMP stacket.

**Nincs** RTMP szerver a futó kódban (`node-media-server` függőség, de nincs `NodeMediaServer` indítás). **Nincs** Redis, **nincs** HLS CDN. Egy Nest folyamat + FFmpeg + lemez.

---

## 13.1 Fogalmak

| Fogalom | Mi |
|---------|-----|
| `Show.id` | műsor UUID (jegy, URL `/live/[id]` általában a **show** id) |
| `Show.streamId` | **HLS mappa neve** és ingest kulcs; string, nem feltétlenül UUID |
| `Show.privateStreamId` | VIP privát adás azonosítója; token `purpose=private` |
| `Show.streamUrl` | opcionális külső/sablon HLS URL (`{streamId}` helyettesítés) |
| `Stream` tábla | `streamKey` = sanitizált streamId; `rtpPort`, `hlsPath`, `isLive`, `showId` |
| User JWT | login; **nem** elég a `.m3u8` letöltéshez |
| Stream token | HMAC (`STREAM_SECRET`), query: `token` + `expiresAt` |

---

## 13.2 streamId logika

### Generálás

Ha a streamer új műsort hoz létre `streamId` nélkül:

```
slug(cím, max 24) + "-" + streamerId első 6 hex (kötőjel nélkül) + "-" + Date.now() base36
```

Kód: `toLocalStreamId` — `backend/src/streamers/streamer-dashboard.service.ts`.

Admin / PATCH felülírhatja. Élőhöz **kötelező** nem üres `streamId`.

### Sanitizálás

`sanitizeStreamId`: minden nem `[a-zA-Z0-9_-]` → `_`.  
A lemezútvonal és a public path ezt használja. Küldj ID-t ékezet nélkül, különben a token `streamId` és a mappa eltérhet, ha az egyik sanitizált, a másik nem.

### Hol tárolódik

- `Show.streamId` — nézői élő / archív
- `Show.privateStreamId` — VIP
- `Stream.streamKey` unique — ingest upsert ezen

Egy `streamId` egy HLS könyvtár: `output/<streamId>/`.

---

## 13.3 Nézői lejátszás (HLS)

```
Böngésző (Hls.js)
  → GET /token/generate?streamId=&showId=&expires=3600&purpose=live|archive|private
       JWT + assertCanWatch (érvényes paid/active jegy, kategória feature, admin kivétel)
  → HMAC token + expiresAt (unix mp)
  → GET {API_URL}/output/{streamId}/index.m3u8?token=&expiresAt=
  → playlistben a .ts / .m4s URL-ekhez a backend hozzáfűzi ugyanazt a query-t
  → GET /output/{streamId}/{segment}?token=&expiresAt=
```

Frontend: `frontend/lib/getStreamToken.ts`, player: `frontend/app/live/[id]/Player.tsx`.  
Alap playlist: `http://127.0.0.1:3200/output/<streamId>/index.m3u8`.

**Második path (legacy):** `GET /stream/:id/index.m3u8` — ugyanaz a token, kevesebb header / `.m4s` kezelés. A UI az **`/output/`** útvonalat használja.

Archív MP4: `GET /output/{streamId}/archive.mp4?token=&expiresAt=` (szegmens endpoint, `archive.mp4` engedélyezett kiterjesztés). Token purpose: `archive`.

### Token számítás

```
expiresAt = now_unix + expiresInSeconds   // default 3600
token = HMAC-SHA256(STREAM_SECRET, `${streamId}:${expiresAt}`) hex
```

Összehasonlítás: string `!==` (nem `timingSafeEqual`). Lejárat után 403 szöveg, nem JSON.

### Jegy vs stream

`assertCanWatch`: jegy `paid` vagy `active`; `nezo` / `interaktiv` / `vip` feature mátrix (`entitlements.ts`). Privát: a `streamId` query = `Show.privateStreamId`.

---

## 13.4 Ingest folyamat (élő)

### Ki indítja

1. Streamer: `POST /streamer/shows/:id/live` `{ live: true, streamId?, rtpPort? }`  
   - műsor státusz **active**  
   - default `rtpPort = 5004`  
   - hívja `IngestService.startIngest`  
   - Conflict ha már fut ehhez a streamId-hez (memória `Set`, process restart törli)  
   - hiba esetén a show `live=true` maradhat, ingest `{ warning }`
2. Admin: `POST /ingest/start` `{ streamId, rtpPort }` (1024–65535)

Élő leállítás: `live: false` → show `archived` ha active volt. **Nem** állítja le explicit az FFmpeg process-t a kódban (a child akkor áll le, ha az input véget ér / crash).

### Amit a kód csinál (`ingest.service.ts`)

1. `ensureStreamOutputDir` → `backend/output/<id>/` (cwd = backend)
2. UDP4 socket **bind `0.0.0.0:rtpPort`**
3. **Első bejövő UDP csomagra** spawn:

```text
ffmpeg -i udp://127.0.0.1:{rtpPort}
       -c:v libx264 -preset veryfast -tune zerolatency
       -c:a aac
       -f hls -hls_time 2 -hls_list_size 6 -hls_flags delete_segments
       output/<streamId>/index.m3u8
```

4. Prisma `Stream` upsert `streamKey`, `isLive true`, `hlsPath`, `rtpPort`; kapcsolódó Show `live true`

### Encoder (külső)

A stúdió szoftver (OBS stb.) **RTP/UDP** csomagot küld a szerver `rtpPort` portjára. Nincs a repóban OBS profil. Tipikus: MPEG-TS vagy RTP a megadott portra, a VPS publikus IP-jére.

### Ismert ütközés (átvételkor olvasd el)

A Node **elfoglalja** az UDP portot. Az FFmpeg ugyanerre a `udp://127.0.0.1:port`-ra akar csatlakozni. Sok környezetben ez **portütközés**: az FFmpeg nem kapja az inputot, vagy a Node nyeli a csomagokat és **nem továbbítja** FFmpegnek (a `message` handler csak az első csomagnál indít, a payloadot eldobja).

A `RtpListener` osztály (`rtp-listener.ts`) fájlba írná a datagramokat — **az IngestService nem használja**.

A `StreamingService.startLiveStream` FFmpeg `rtp://localhost:5004`, hls_time 4 — **nincs controller hívás**, holt kód.

Ha az élő kép nem jelenik meg: (1) FFmpeg a PATH-on van-e, (2) van-e `index.m3u8` a lemezen, (3) UDP eléri-e a processt, (4) ez a bind vs FFmpeg verseny.

Gyakorlati debug: `pm2 logs`, keresd: `RTP listener running`, `FFmpeg elindul`, `FFmpeg ingest:`.

---

## 13.5 HLS a lemezen

Gyökér: `path.join(process.cwd(), "output")` → **`backend/output/`**, ha onnan indítod a Nestet.

```
output/
  <streamId>/
    index.m3u8          # élő sliding window (~6 szegmens, 2 mp)
    segmentN.ts         # FFmpeg nevezi; delete_segments törli a régieket
    recording.mp4       # opcionális; ha létezik, az archív EZT részesíti előnyben
    archive.mp4         # generateArchive kimenet
```

Public URL: `/output/<streamId>/index.m3u8` (Nest controller, nem `express.static` az output-ra — token kell).

`uploads/` külön: csak avatar (`/uploads/avatars/`).

---

## 13.6 Archív videó

### Mikor

Admin: `POST /archive/generate/:showId` vagy `POST /admin/shows/:id/archive/regenerate`.  
A show-nak kell `streamId`.

### FFmpeg (`ffmpeg-pipeline.ts`)

1. Ha van `output/<id>/recording.mp4` → input az  
2. Különben `index.m3u8` + `-allowed_extensions ALL`  
3. Először `-c copy` → `archive.mp4`  
4. Ha ez elhasal → re-encode `libx264 veryfast` + `aac`  
5. Prisma `Archive` upsert (`filePath`, `publicPath`, `size`)  
6. Ha van recording fájl: `Recording` sor (hiba elnyelve)  
7. Email `archive_ready`

**Veszély:** `delete_segments` miatt a playlist **nem** a teljes adás. Teljes archívhoz kell `recording.mp4` (ezt a jelenlegi ingest **nem** írja), vagy FFmpeg `-hls_flags` / külön record kimenet bevezetése.

Törlés: `DELETE /archive/:showId` — lemez `archive.mp4` + DB sor.

Publikus lista: `GET /archives` — fájl vagy DB Archive.

---

## 13.7 WebRTC

`webrtc.gateway.ts`: Socket.IO `offer` / `answer` / `ice` → `broadcast` minden más kliensnek. Nincs show szoba, nincs JWT. **Nem** helyettesíti a HLS ingestet; kísérleti signaling.

---

## 13.8 Fájltérkép

| Fájl | Szerep |
|------|--------|
| `ingest/ingest.service.ts` | UDP + FFmpeg HLS (élő, használt) |
| `ingest/ingest.controller.ts` | admin start |
| `ingest/rtp-listener.ts` | unused dump-to-file |
| `streaming/hls-paths.ts` | útvonalak |
| `streaming/ffmpeg-pipeline.ts` | archív MP4 |
| `streaming/streaming.service.ts` | unused FFmpeg RTP |
| `streaming/streaming.controller.ts` | `/stream/*` HLS |
| `hls/hls.controller.ts` | `/output/*` HLS + live heartbeat |
| `security/token/token.service.ts` | HMAC |
| `tickets/tickets.service.ts` | `assertCanWatch` |
| `archive/archive.service.ts` | generate / sync DB |
| `stats/live-view-tracker.ts` | memória nézőszám |
| `frontend/lib/getStreamToken.ts` | kliens |

---

## 13.9 Checklist új gép / új fejlesztő

1. `ffmpeg` a PATH-on (`ffmpeg -version`)
2. Nest cwd = `backend` (különben üres `output/`)
3. Műsor `streamId` + státusz `active`
4. UDP port szabad és a tűzfal engedi
5. Jegy + `/token/generate` + playlist 200
6. Archív: ne a 12 másodperces HLS ablakra támaszkodj

Kapcsolódó: [02-api.md](./02-api.md) stream szekció, [11-infra.md](./11-infra.md) UDP/tűzfal.
