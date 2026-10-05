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
| Stream token | HMAC (`STREAM_SECRET`) `streamId:expiresAt:userId:ip`; HttpOnly `ls_hls` süti; élő 120s / archív 300s |

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
Böngésző (Hls.js, xhr.withCredentials)
  → GET /token/generate?streamId=&showId=&purpose=live|archive|private
       JWT vagy vendég viewerKey + assertCanWatch
  → Set-Cookie ls_hls (HttpOnly); JSON-ben nincs token
  → GET /output/{streamId}/index.m3u8  (same-origin rewrite, süti)
  → szegmensek ugyanígy, token nincs a URL-ben
```

Frontend: `frontend/lib/getStreamToken.ts`, player: `frontend/app/live/[id]/Player.tsx`.  
Playlist: `/output/<streamId>/index.m3u8` (Next rewrite a 3200-ra).

**Második path:** `GET /stream/:id/index.m3u8` — ugyanaz a token-ellenőrzés. A UI az **`/output/`** útvonalat használja.

Archív MP4: `GET /output/{streamId}/archive.mp4` (süti). Token purpose: `archive`.

### Token számítás

```
ttl = live 120s / archive 300s
expiresAt = now_unix + ttl
token = HMAC-SHA256(STREAM_SECRET, `${streamId}:${expiresAt}:${userId}:${ip}`) hex
```

Lejárat / rossz IP / rossz HMAC → 403 szöveg, nem JSON. Query `token` + `expiresAt` + `userId` másodlagos fallback (rövid TTL + IP).

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
2. **UDP `udp://0.0.0.0:{rtpPort}`**, spawn FFmpeg (`cwd` = `output/<streamId>/`):

```text
ffmpeg -threads 2 -i udp://0.0.0.0:{rtpPort}
       -filter:v scale=1280:720:... ,fps=30
       -c:v libx264 -preset veryfast -tune zerolatency
       -b:v 2000k -maxrate 2500k -bufsize 5000k
       -c:a aac
       -f tee "[f=hls:hls_time=2:hls_list_size=6:hls_flags=delete_segments]index.m3u8|
               [f=mp4:movflags=+frag_keyframe+empty_moov+default_base_moof]recording.mp4"
```

Egy x264 encode; a `recording.mp4` a **tee másolat**. FFmpeg `PRIORITY_BELOW_NORMAL` (`os.setPriority`). Részletek: [scalability-p0.md](./scalability-p0.md).

3. Prisma `Stream` upsert `streamKey`, `isLive true`, `hlsPath`, `rtpPort`; kapcsolódó Show `live true`

### Encoder (külső)

A stúdió szoftver (OBS stb.) **RTP/UDP** csomagot küld a szerver `rtpPort` portjára. Nincs a repóban OBS profil. Tipikus: MPEG-TS vagy RTP a megadott portra, a VPS publikus IP-jére.

### Ismert ütközés (átvételkor olvasd el)

Az **FFmpeg** köti a `udp://0.0.0.0:rtpPort` portot (a Nest nem). Két ingest ugyanarra a portra = Conflict vagy bind hiba. A `RtpListener` / `StreamingService.startLiveStream` **holt kód**.

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

**Veszély:** `delete_segments` miatt a playlist **nem** a teljes adás. A teljes archívum a tee `recording.mp4`-ből készül (`-c copy`, fallback re-encode).

Törlés: `DELETE /archive/:showId` — lemez `archive.mp4` + DB sor.

Publikus lista: `GET /archives` — fájl vagy DB Archive.

---

## 13.7 Élő videó (WebRTC)

Alap: mesh (`StreamerLiveCamera` + `LiveWebRtcWatch` + `webrtc.gateway.ts` offer/ice). Chat/reactions maradnak `/live-io`-n.

B fázis: ha `GET /livekit/config` `backend=livekit`, a publisher/néző LiveKit SFU (`docs/19-livekit.md`). A mesh ugyanazon `showId`-n nem fut párhuzamosan.

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
