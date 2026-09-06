# 15. Biztonsági dokumentáció

Őszinte állapot: a termék **fejlesztői / belső** szinten van. Éles internet elé tenni a lenti hiányosságok javítása nélkül magas kockázat (fiókeltérítés, ingyen stream, fizetés megkerülés).

---

## 15.1 Jelenlegi állapot (tény)

| Terület | Ma |
|---------|-----|
| User JWT | titok **`"secret123"`** a forráskódban; lejárat 7 nap; `Authorization: Bearer` |
| JWT env | `JWT_SECRET` **nincs bekötve** |
| Stream HMAC | `STREAM_SECRET` vagy default **`dev-secret`**; összehasonlítás nem timing-safe |
| CORS | csak `http://localhost:3000` és `http://127.0.0.1:3000` |
| HTTPS | nincs a appban; fejlesztés HTTP |
| Rate limit | nincs |
| Helmet / CSP | nincs Nest szinten |
| Jelszó | bcrypt |
| Ban | JWT validate ellenőrzi `User.status` |
| Admin | DB role vagy email `admin@admin.com` |
| Feltöltés | avatar MIME + 5 MB; nincs vírusellenőrzés; `diskStorage` a `uploads/` alá |
| Fizetés | Stripe/Barion opcionális; **`POST /payments/confirm-dev`** JWT-vel teszt-lezárás |
| Barion IPN | `GET\|POST /api/barion/webhook` **auth nélkül** |
| WebSocket | CORS `origin: '*'`, nincs JWT a signalingon |
| HLS | token query-ben (logokba / Refererbe kerülhet) |
| UDP ingest | `0.0.0.0`, nincs encoder allowlist a kódban |
| Secret a gitben | `.env` ignore; a JWT string **benne van a repóban** |
| SQL | Prisma + néhány `$queryRaw` / `$executeRaw` (EmailLog, PlatformConfig) |

---

## 15.2 Ismert hiányosságok

1. **Bárki, aki olvassa a kódot, ki tudja adni a JWT-t** (`secret123`) — teljes admin, ha ismeri a user id-t / beregisztrál bootstrap emaillel.
2. **CORS localhost** — más domainről a böngészős fetch elhasal; éles domain **nincs** engedve. Fordítva: ha valaki kinyitja `0.0.0.0:3200`-at, más kliensek (nem böngésző) CORS nélkül hívhatják az API-t.
3. **`confirm-dev`** — élesben ingyen aktiválható a jegy, ha a végpont elérhető.
4. **Nyílt webhook** — hamis Barion IPN (állapotfüggő, de védtelen).
5. **Bootstrap admin email** — aki lefoglalja / ismeri, admin.
6. **HLS token a URL-ben** — megosztható a lejáratig; nincs user-kötés a HMAC-ben (csak streamId + idő). A jegyellenőrzés csak a `/token/generate`-kor van, a szegmenskérésnél már nem.
7. **WebRTC broadcast** — bárki joinolhat és offer-t lökhet.
8. **Nincs brute-force védelem** a `/auth/login`-on.
9. **FFmpeg `exec` archív** — `streamId` sanitizálva van a pathban; maradjon így, ne fűzz nyers user stringet a shellbe.
10. **PM2 / `.env` jogosultság** — ha a VPS-en a fájl world-readable, a Stripe/SMTP kint van.
11. **Ingest Conflict csak memóriában** — restart után újra indítható ugyanaz a port.
12. **Nincs audit** a login / payout paid-ről (payout approve küld emailt).

---

## 15.3 Javasolt javítások (prioritás)

### P0 — éles előtt kötelező

- JWT titok **env** (`JWT_SECRET`), erős random; forrásból törölni a `secret123`-at; minden session invalidálódik.
- `STREAM_SECRET` erős, ne default.
- `confirm-dev` csak `NODE_ENV !== 'production'` vagy `ALLOW_DEV_PAY=true`.
- CORS: pontos `FRONTEND_URL` origin lista.
- `API_URL` a frontenden env / build-time (`NEXT_PUBLIC_API_URL`).
- HTTPS (Nginx), HSTS.
- Bootstrap admin: első user vagy env `BOOTSTRAP_ADMIN_EMAIL`, ne publikus ismert cím a kódban.

### P1 — hamarosan

- Rate limit (login, contact, webhook).
- Barion webhook: IP allowlist vagy aláírás / POSKey ellenőrzés a payloadon (a GetPaymentState már hívható — a webhookot state fetch-hez kösd, ne bízz a kliens bodyban).
- HMAC `crypto.timingSafeEqual`.
- Stream tokenbe `userId` (vagy rövid élő ticket-id), hogy a leaked URL kevésbé legyen univerzális.
- UDP: firewall allowlist az encoder IP-re.
- Socket.IO: origin + auth.

### P2 — érés

- Helmet, szigorú cookie ha áttértek cookie sessionre (ma localStorage token — XSS = account takeover).
- Titkok rotációja, PM2 env file `chmod 600`.
- Dependabot / `npm audit`.
- WAF / fail2ban SSH.
- Backup encryption.
- Admin 2FA.

---

## 15.4 Threat model (rövid)

| Támadó | Mit nyer ma könnyen |
|--------|---------------------|
| Kódhozzáférés | JWT mint admin |
| Hálózaton lévő API 3200 | login brute, confirm-dev, ingest ha van admin token |
| Jegy nélküli néző | HLS URL ha megosztják vele a tokenes playlistet |
| Encoder nélkül UDP | szemét a portra / FFmpeg indítás első csomagra |

---

## 15.5 Biztonságos fejlesztés

Új admin végpont: `JwtAuthGuard` + `AdminGuard`.  
Pénz / jegy: ne bízz a kliens `price` mezőben (a buy a kategória DB árat használja — tartsd).  
Dokumentáld a változást itt, ha P0 item kész.

Kapcsolódó: [07-jogosultsagok.md](./07-jogosultsagok.md), [12-env.md](./12-env.md), [13-streaming.md](./13-streaming.md).
