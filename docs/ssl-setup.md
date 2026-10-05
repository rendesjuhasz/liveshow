# SSL setup — Nginx + Let's Encrypt (single VPS)

This matches the LiveShow repo: Next.js on **3000**, NestJS on **3200**, PM2 names `liveshow-web` / `liveshow-api`, HLS at `/output/`, VOD uploads up to **2 GB**, UDP ingest **not** through Nginx.

Canonical files:

| File | Role |
|------|------|
| [deploy/nginx/liveshow-http-bootstrap.conf](../deploy/nginx/liveshow-http-bootstrap.conf) | Port 80 only, first certificate |
| [deploy/nginx/liveshow.conf](../deploy/nginx/liveshow.conf) | Production HTTPS after the cert exists |
| This document | DNS, Certbot, renewal, checks |

Replace `YOUR_DOMAIN` with the apex hostname from [ops-inventory.md](./ops-inventory.md) (example: `liveshow.hu`). Then:

- Site: `https://YOUR_DOMAIN` and `https://www.YOUR_DOMAIN` → Next
- API: `https://api.YOUR_DOMAIN` → Nest
- Live: `https://live.YOUR_DOMAIN` → LiveKit WSS (`127.0.0.1:7880`)

One certificate covers all four names. The live directory is `/etc/letsencrypt/live/YOUR_DOMAIN/` (Certbot uses the first `-d` as the folder name).

## 0. What Nginx does not do

- **UDP RTP** (OBS → `rtpPort`, often 5004) goes to the VPS public IP. Firewall UDP; Nginx is TCP 80/443 only.
- **Do not** publish 3000 or 3200 on the internet. UFW: allow 22, 80, 443, and UDP ingest.

## 1. DNS (do this first)

At the registrar, A (and AAAA if you have IPv6) for:

| Name | Type | Value |
|------|------|--------|
| `YOUR_DOMAIN` | A | VPS IPv4 |
| `www.YOUR_DOMAIN` | A | same |
| `api.YOUR_DOMAIN` | A | same |
| `live.YOUR_DOMAIN` | A | same |

Wait until `dig +short YOUR_DOMAIN www.YOUR_DOMAIN api.YOUR_DOMAIN` all return that IP. HTTP-01 will fail otherwise.

## 2. Packages (Ubuntu 22.04 / 24.04)

```bash
sudo apt update
sudo apt install -y nginx certbot
sudo mkdir -p /var/www/certbot
sudo chown www-data:www-data /var/www/certbot
```

Do **not** install Apache. Disable the default site:

```bash
sudo rm -f /etc/nginx/sites-enabled/default
```

## 3. App must already answer locally

Before proxying:

```bash
curl -sS http://127.0.0.1:3000 | head
curl -sS http://127.0.0.1:3200/health/live
curl -sS http://127.0.0.1:3200/health/uptime
```

PM2: `liveshow-web` and `liveshow-api` online. See [14-deploy.md](./14-deploy.md).

## 4. Bootstrap Nginx (HTTP)

From the repo on the VPS (`/var/www/liveshow`):

```bash
DOMAIN=YOUR_DOMAIN   # e.g. liveshow.hu
sed "s/YOUR_DOMAIN/${DOMAIN}/g" deploy/nginx/liveshow-http-bootstrap.conf \
  | sudo tee /etc/nginx/sites-available/liveshow >/dev/null
sudo ln -sfn /etc/nginx/sites-available/liveshow /etc/nginx/sites-enabled/liveshow
sudo nginx -t && sudo systemctl reload nginx
```

Check: `curl -sI http://api.${DOMAIN}/health/live` → 200.

## 5. Issue the certificate

Use **webroot** (does not rewrite your site file). Email = Let's Encrypt expiry notices (same as inventory “Let's Encrypt email”).

```bash
DOMAIN=YOUR_DOMAIN
sudo certbot certonly --webroot -w /var/www/certbot \
  --agree-tos --no-eff-email \
  -m LE_EMAIL@YOUR_DOMAIN \
  -d "$DOMAIN" -d "www.$DOMAIN" -d "api.$DOMAIN" -d "live.$DOMAIN"
```

Expect: `/etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem` and `privkey.pem`.

If Certbot says the name does not match the folder, run `sudo certbot certificates` and put that **Certificate Name** into the `ssl_certificate` paths in `liveshow.conf`.

## 6. Production Nginx (HTTPS)

```bash
DOMAIN=YOUR_DOMAIN
sed "s/YOUR_DOMAIN/${DOMAIN}/g" deploy/nginx/liveshow.conf \
  | sudo tee /etc/nginx/sites-available/liveshow >/dev/null
sudo nginx -t && sudo systemctl reload nginx
```

Verify:

```bash
curl -sI https://YOUR_DOMAIN
curl -sI https://www.YOUR_DOMAIN
curl -sS https://api.YOUR_DOMAIN/health/live
curl -sI https://live.YOUR_DOMAIN
# HTTP must redirect:
curl -sI http://YOUR_DOMAIN | head -n 5
```

Uptime monitors: `https://api.YOUR_DOMAIN/health/uptime` and `https://YOUR_DOMAIN/` ([MONITORING.md](../MONITORING.md)).

## 7. App env that must match TLS

`backend/.env` (restart API after edit):

```env
NODE_ENV=production
FRONTEND_URL=https://YOUR_DOMAIN
BACKEND_URL=https://api.YOUR_DOMAIN
JWT_SECRET=  # long random; required in production
```

If the site is also served on `www`, set:

```env
FRONTEND_URL=https://YOUR_DOMAIN,https://www.YOUR_DOMAIN
```

(`corsOrigins()` splits on comma.) Production CORS uses this list plus localhost.

**Frontend HLS URLs are baked at `next build`.** Before `npm run build` in `frontend/`:

```bash
export NEXT_PUBLIC_API_URL=https://api.YOUR_DOMAIN
npm run build
pm2 restart liveshow-web
```

Without this, the player still points at `http://127.0.0.1:3200/output/...` (see `frontend/lib/getStreamToken.ts`). JSON calls from the browser use same-origin `/api` (Next rewrite) and do not need that variable.

Barion/Stripe return URLs follow `FRONTEND_URL`. Barion IPN/webhook: `https://api.YOUR_DOMAIN/api/barion/webhook`.

## 8. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5004/udp   # or the show rtpPort; encoder IP only if you can
sudo ufw deny 3000/tcp
sudo ufw deny 3200/tcp
sudo ufw enable
sudo ufw status
```

## 9. Renewal procedure

Certbot installs a systemd timer. Confirm:

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

LiveShow uses **webroot**. Renewal does not need `--nginx`. After a successful renew, Nginx must reload to pick up new PEMs. Drop this hook **once**:

```bash
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh >/dev/null <<'EOF'
#!/bin/sh
systemctl reload nginx
EOF
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

Cadence: Let's Encrypt certificates last **90 days**. The timer typically runs twice daily and renews around **30 days** before expiry.

Manual renew (if the timer failed):

```bash
sudo certbot renew
sudo systemctl reload nginx
sudo certbot certificates
```

Expiry check:

```bash
echo | openssl s_client -connect api.YOUR_DOMAIN:443 2>/dev/null | openssl x509 -noout -dates
```

If HTTP-01 fails after you switched to HTTPS: keep the `listen 80` + `/.well-known/acme-challenge/` server in `liveshow.conf` (already there). Do not redirect ACME to HTTPS in a way that skips that location.

Record `certbot.timer` = yes in [ops-inventory.md](./ops-inventory.md).

## 10. Common failures

| Symptom | Cause |
|---------|--------|
| `CERTBOT` unauthorized | DNS not pointing here, or port 80 closed, or ACME location missing |
| `nginx -t` unknown ssl_certificate | You installed `liveshow.conf` before `certonly` |
| Browser mixed content / HLS 127.0.0.1 | Forgot `NEXT_PUBLIC_API_URL` at frontend **build** |
| CORS error on `api.` from `www.` | `FRONTEND_URL` missing `https://www.YOUR_DOMAIN` |
| Upload 413 | `client_max_body_size` not 2048m on the **www** server (uploads go `/api` → Next) |
| Live video stalls after Nginx | `proxy_buffering` still on for `/output/` |
| OBS no picture, site OK | UDP `rtpPort` not open; Nginx cannot fix ingest |

Related: [11-infra.md](./11-infra.md), [14-deploy.md](./14-deploy.md), [DISASTER_RECOVERY.md](../DISASTER_RECOVERY.md) §4 TLS.
