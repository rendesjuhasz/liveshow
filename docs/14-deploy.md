# 14. Deployment dokumentáció

A repóban **nincs** GitHub Actions vagy Dockerfile. A PM2 fájl a gyökérben van: [`ecosystem.config.js`](../ecosystem.config.js). Monitoring: [MONITORING.md](../MONITORING.md).

Fejlesztői gép: [05-telepites.md](./05-telepites.md), ne PM2.

---

## 14.1 Előfeltételek a szerveren

- Node 20+, npm, git, PostgreSQL (vagy managed), FFmpeg, Nginx, PM2 (`npm i -g pm2`)
- `backend/.env` a szerveren (nem gitből)
- Domain + tanúsítvány

PM2 `cwd` **kötelezően** a `backend` illetve `frontend` mappa (`output/` a backend cwd-től függ).

Repo gyökérből:

```bash
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

A config: egy API instance (`fork`, ingest nem cluster-safe), API `max_memory_restart: 1024M`, web `512M`, logok `logs/api-*.log` és `logs/web-*.log`. P0 ingest/HLS: [scalability-p0.md](./scalability-p0.md).

Régebbi abszolút `cwd` példa (ha a deploy path más):

```js
module.exports = {
  apps: [
    {
      name: "liveshow-api",
      cwd: "/var/www/liveshow/backend",
      script: "dist/main.js",
      instances: 1,
      env: { NODE_ENV: "production" },
    },
    {
      name: "liveshow-web",
      cwd: "/var/www/liveshow/frontend",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      env: { NODE_ENV: "production" },
    },
  ],
};
```

**Egy instance** az API-ra: az ingest `Set` és az FFmpeg child **nem** cluster-safe. Több Nest replica = dupla bind UDP-n.

---

## 14.2 Első telepítés

Egy VPS. Sorrend: DNS → app localhoston → HTTP Nginx → Certbot → HTTPS Nginx → HTTPS env + frontend rebuild.

```bash
sudo mkdir -p /var/www/liveshow
sudo chown "$USER":"$USER" /var/www/liveshow
cd /var/www/liveshow
git clone <REPO_URL> .
# backend/.env: DATABASE_URL, JWT_SECRET, NODE_ENV=production, SMTP, FRONTEND_URL/BACKEND_URL
#   (HTTPS URL-eket a cert után véglegesítsd — lásd ssl-setup.md §7)

cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
cd ../frontend
npm ci
# első build lehet localhost API-val; HTTPS után kötelező újra:
# NEXT_PUBLIC_API_URL=https://api.YOUR_DOMAIN npm run build
npm run build

cd /var/www/liveshow
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Ezután **pontosan** [ssl-setup.md](./ssl-setup.md):

1. DNS A rekordok: apex, `www`, `api`, `live` → VPS IP  
2. `sudo bash deploy/livekit/ufw-livekit.sh` (80/443 TCP; UDP 50000–50050 + TURN; 3000/3200/7880 zárva)  
3. Bootstrap: `deploy/nginx/liveshow-http-bootstrap.conf`  
4. `certbot … -d YOUR_DOMAIN -d www.YOUR_DOMAIN -d api.YOUR_DOMAIN -d live.YOUR_DOMAIN`  
5. Production: `deploy/nginx/liveshow.conf`  
6. LiveKit: [19-livekit.md](./19-livekit.md) (`install.sh` + Nest `LIVE_VIDEO_BACKEND=livekit`)  
7. Renew hook: `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh`  
8. `FRONTEND_URL` / `BACKEND_URL` + `NEXT_PUBLIC_API_URL=https://api.YOUR_DOMAIN` és frontend `npm run build` + `pm2 restart`

Ellenőrzés: `curl -sS https://api.YOUR_DOMAIN/health/uptime` és a nyilvános site 200.

Nginx + Let's Encrypt: [ssl-setup.md](./ssl-setup.md) (fájlok: `deploy/nginx/`).

Éles env a TLS után (kötelező):

```bash
# backend/.env
FRONTEND_URL=https://YOUR_DOMAIN
BACKEND_URL=https://api.YOUR_DOMAIN

# frontend build (HLS URL beégetés)
cd /var/www/liveshow/frontend
NEXT_PUBLIC_API_URL=https://api.YOUR_DOMAIN npm run build
```

PM2 parancs a repóban: `pm2 start ecosystem.config.js` (nem `.cjs`).

---

## 14.3 Frissítés (lépésről lépésre)

Karbantartási ablak: élő adás alatt a `git pull` / restart **eldobja** az FFmpeg ingestet.

```bash
cd /var/www/liveshow
git status
git pull

cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build

cd ../frontend
npm ci
NEXT_PUBLIC_API_URL=https://api.YOUR_DOMAIN npm run build

pm2 restart liveshow-api liveshow-web
pm2 status
```

Windows fejlesztőnél a parancsok ugyanazok Git Bash-ben; PM2 ott ritka — használd a Linux VPS-t.

Ha `npm ci` lockfile miatt elhasal: `npm install`, de élesen a lockfile a forrás.

Ellenőrzés:

- `curl -sI https://api.pelda.hu/` (vagy GET `/`)
- UI login
- `pm2 logs liveshow-api --lines 80`
- Prisma: `\dt` vagy `npx prisma migrate status`

---

## 14.4 Rollback

Cél: előző **git commit** + kompatibilis adatbázis.

```bash
cd /var/www/liveshow
git log -5 --oneline
git rev-parse HEAD > /tmp/liveshow-prev-sha   # opcionális, pull ELŐTT

# vissza egy commitra (példa)
git fetch
git checkout <ELŐZŐ_SHA>

cd backend
npm ci
npx prisma generate
npm run build
cd ../frontend
npm ci
npm run build
pm2 restart liveshow-api liveshow-web
```

**Migráció:** a Prisma `migrate deploy` **előre** megy. Ha az új release sémát változtatott, a `git checkout` régi kód **eltörhet** az új oszlopokon, vagy hiányzó oszlopot vár.

Rollback séma:

1. Ideális: `migrate deploy` csak **backward compatible** (új nullable oszlop).
2. Ha breaking migrate ment ki: készíts **down SQL**-t kézzel, vagy állítsd vissza a `pg_dump`-ot ([11-infra.md](./11-infra.md) backup).
3. Ne futtass vakon `prisma migrate reset` éles adatbázison.

Fájlok: a `output/` és `uploads/` **nem** gitben; rollback a kódra ezeket nem törli.

`.env` rollback: titkosított másolatból, ne git historyból.

---

## 14.5 Mit ne csinálj

- `git pull` force a szerveren, ha helyi `.env` / `output` dirty — stash/ne keverd
- `prisma migrate dev` élesben (interaktív, új migration fájl)
- API cluster mode PM2-n ingest mellett
- `confirm-dev` fizetés élesben nyitva hagyása ([15-security.md](./15-security.md))

---

## 14.6 Gyors visszaállítás process szinten

Csak crash, kód OK:

```bash
pm2 restart liveshow-api
```

Adatbázis gyanú:

```bash
# dump teszt restore külön gépen, ne az élesen kísérletezz
```
