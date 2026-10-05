# Cloudflare Tunnel — streamtest.hu → localhost:3000

Nincs VPS. A Next.js UI a saját gépen fut **3000**-en, a NestJS **3200**-on. A Cloudflare Tunnel a `https://streamtest.hu` forgalmát a gép `http://127.0.0.1:3000` címére viszi. A 3200-as port **nem** megy ki a netre: a Next `/api`, `/live-io`, `/output` rewrite-ja a gépen belül továbbítja a Nesthez.

Gyors (egyszeri `*.trycloudflare.com`) tunnel: lásd a dokumentum végét. Stabil teszteléshez **elnevezett tunnel + saját domain** kell.

---

## Előfeltételek

1. A `streamtest.hu` domain **Cloudflare-en van** (a registrar nameserverjei Cloudflare NS-ek).
2. Ingyenes Cloudflare fiók, amelyhez a zóna tartozik.
3. Windows, admin jog a `cloudflared` telepítéséhez.
4. Három folyamat később: Nest (3200), Next (3000), `cloudflared`.

Ha a domain még **nem** Cloudflare-en van: Cloudflare Dashboard → **Add a site** → `streamtest.hu` → Free plan → a kapott két nameservert állítsd be a registrarodnál. Várj, amíg a zóna **Active**.

---

## 1. cloudflared telepítése

PowerShell:

```powershell
winget install --id Cloudflare.cloudflared -e --accept-package-agreements --accept-source-agreements
```

Új terminál, ellenőrzés:

```powershell
cloudflared --version
```

Ha a PATH még üres:

```powershell
& "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe" --version
```

Ezen a gépen a bináris tipikusan: `C:\Program Files (x86)\cloudflared\cloudflared.exe`

---

## 2. Bejelentkezés (tunnel token / cert)

```powershell
cloudflared tunnel login
```

Megnyílik a böngésző. Válaszd a **streamtest.hu** zónát, engedélyezd. Létrejön:

`C:\Users\<felhasználó>\.cloudflared\cert.pem`

---

## 3. Elnevezett tunnel létrehozása

Egyszer kell:

```powershell
cloudflared tunnel create liveshow-local
```

A kimenetben megjelenik a **Tunnel ID** (UUID) és a credentials fájl, pl.:

`C:\Users\<felhasználó>\.cloudflared\<TUNNEL-ID>.json`

Listázás:

```powershell
cloudflared tunnel list
```

---

## 4. Ingress config (localhost:3000)

Hozd létre / szerkeszd: `C:\Users\<felhasználó>\.cloudflared\config.yml`

A `<TUNNEL-ID>` és a Windows felhasználónév helyett a saját értékeid:

```yaml
tunnel: <TUNNEL-ID>
credentials-file: C:\Users\LENOVO\.cloudflared\<TUNNEL-ID>.json

ingress:
  - hostname: streamtest.hu
    service: http://127.0.0.1:3000
  - hostname: www.streamtest.hu
    service: http://127.0.0.1:3000
  - service: http_status:404
```

Ne irányítsd a 3200-at külön hostname-re. A WebSocket (`/live-io`) és a HLS (`/output`) a 3000-es Next rewrite-on megy.

---

## 5. DNS rekordok (domain hozzárendelése)

A Cloudflare zónába CNAME kell, ami a tunnelre mutat. A CLI megcsinálja (proxied, narancssárga felhő):

```powershell
cloudflared tunnel route dns liveshow-local streamtest.hu
cloudflared tunnel route dns liveshow-local www.streamtest.hu
```

Dashboardon ugyanez: **DNS → Records**

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `@` (apex) | `<TUNNEL-ID>.cfargotunnel.com` | Proxied (narancs) |
| CNAME | `www` | `<TUNNEL-ID>.cfargotunnel.com` | Proxied (narancs) |

Ne legyen A rekord a gép nyilvános IP-jére. Cloudflare Tunnel = CNAME a `cfargotunnel.com`-ra, **nem** portforward 80/443.

Ellenőrzés:

```powershell
nslookup streamtest.hu
```

A válasz Cloudflare IP-k legyenek (nem a géped LAN IP-je).

---

## 6. HTTPS a Cloudflare-en

Dashboard → **streamtest.hu**:

1. **SSL/TLS → Overview:** Encryption mode **Full** (ne Flexible). A látogató HTTPS-t kap; a gép felé HTTP megy a tunnelen belül.
2. **SSL/TLS → Edge Certificates:** **Always Use HTTPS** = On.
3. **Network:** **WebSockets** = On (élő `/live-io`).
4. Opcionális: **HTTPS Rewrites**, HSTS később.

A tanúsítványt a Cloudflare adja. Helyi Let's Encrypt / Nginx nem kell.

---

## 7. Alkalmazás indítása, majd a tunnel

**Három ablak**, ebben a sorrendben.

### 7.1 NestJS (3200)

```powershell
cd "C:\Users\LENOVO\Asztal\Streaming Platform\backend"
npm run start:dev
```

Health:

```powershell
curl.exe -sI http://127.0.0.1:3200/health
```

`200` / `Nest application successfully started`. Nincs `EADDRINUSE`.

A `backend/.env` publikus originje:

```env
APP_URL="https://streamtest.hu"
FRONTEND_URL="https://streamtest.hu"
BACKEND_URL="https://streamtest.hu"
BACKEND_PUBLIC_URL="https://streamtest.hu"
```

### 7.2 Next.js (3000)

```powershell
cd "C:\Users\LENOVO\Asztal\Streaming Platform\frontend"
npm run dev
```

```powershell
curl.exe -sI http://127.0.0.1:3000
```

A `frontend/.env.local`:

```env
NEXT_PUBLIC_SITE_URL=https://streamtest.hu
NEXT_PUBLIC_API_URL=http://127.0.0.1:3200
```

A böngésző **nem** a 3200-at hívja; same-origin `/api` a 3000-en.

### 7.3 Tunnel

```powershell
cloudflared tunnel run liveshow-local
```

Hagyd nyitva. Leállítás: Ctrl+C.

Ha a `config.yml` nem a default helyen van:

```powershell
cloudflared tunnel --config "C:\Users\LENOVO\.cloudflared\config.yml" run liveshow-local
```

---

## 8. HTTPS és a domain ellenőrzése

Böngésző:

- https://streamtest.hu
- https://streamtest.hu/live
- https://streamtest.hu/streamer/live (kamera HTTPS-en)

Lakat: érvényes Cloudflare tanúsítvány, ne legyen „Not secure”.

Parancssor:

```powershell
curl.exe -sI https://streamtest.hu
curl.exe -sI https://streamtest.hu/api/health
```

Elvárt: `HTTP/2 200` (vagy 307/308 HTTPS redirect után 200). A `/api/health` a Next rewrite-on a Nest healthjét adja, ha a Nest `/health` a gyökéren van — ha 404, próbáld a Nest közvetlen `http://127.0.0.1:3200/health` címet, és a UI-t a domainen.

Ha a lakat jó, de üres/hibás oldal: a tunnel fut, a Next nem (vagy rossz `service` URL a configban).

---

## 9. Tipikus hibák

| Tünet | Ok | Teendő |
|--------|-----|--------|
| `Error 1033` / tunnel down | `cloudflared` nem fut | `tunnel run`, hagy nyitva |
| `Error 530` / DNS | nincs CNAME vagy nem proxied | `tunnel route dns`, narancs felhő |
| Kapcsolódik, de API hiba | Nest nem fut | 3200 health |
| Kamera HTTP-n tiltva | HTTP origin | csak `https://streamtest.hu` |
| WebSocket nem kapcsol | WS ki, vagy Next nem fut | Network → WebSockets On; `/live-io` rewrite |
| Régi trycloudflare URL | quick tunnel | named tunnel + `streamtest.hu` |
| Mixed content / rossz link | env localhost | `FRONTEND_URL=https://streamtest.hu`, restart Nest+Next |

A gép alvása / Wi‑Fi váltás megszakítja a tunnelt. Ébresztés után `tunnel run` újra.

---

## Gyors tunnel (domain nélkül)

Csak ideiglenes `https://….trycloudflare.com`. A hostname **minden indításkor változik**, a `streamtest.hu` **nem** ehhez tartozik.

```powershell
# Nest + Next már fusson
powershell -ExecutionPolicy Bypass -File .\scripts\start-cloudflare-tunnel.ps1
```

Vagy:

```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:3000 --no-autoupdate
```
