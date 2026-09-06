# 14. Deployment dokumentáció

A repóban **nincs** GitHub Actions, Dockerfile vagy PM2 ecosystem fájl. Az alábbi a **ajánlott** Linux VPS menet, PM2-vel. Első élesítés: [11-infra.md](./11-infra.md) + [12-env.md](./12-env.md) + CORS/`API_URL` kódmódosítás.

Fejlesztői gép: [05-telepites.md](./05-telepites.md), ne PM2.

---

## 14.1 Előfeltételek a szerveren

- Node 20+, npm, git, PostgreSQL (vagy managed), FFmpeg, Nginx, PM2 (`npm i -g pm2`)
- `backend/.env` a szerveren (nem gitből)
- Domain + tanúsítvány

PM2 `cwd` **kötelezően** a `backend` illetve `frontend` mappa (`output/` a backend cwd-től függ).

Példa `ecosystem.config.cjs` (még nincs a gitben — hozd létre a szerveren):

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

```bash
sudo mkdir -p /var/www/liveshow
sudo chown "$USER":"$USER" /var/www/liveshow
cd /var/www/liveshow
git clone <REPO_URL> .
# backend/.env létrehozása (12-env.md)

cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
cd ../frontend
npm ci
npm run build

cd /var/www/liveshow
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Nginx + certbot: [11-infra.md](./11-infra.md).

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
npm run build

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
