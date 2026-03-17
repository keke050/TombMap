# Public deployment (Docker + Caddy + Postgres)

This project is a Next.js app with API routes (`app/api/*`). For a long-running public website (your computer can be off), deploy it to a server (VPS) and run with Docker Compose.

## 1) Prerequisites

- A VPS (Ubuntu recommended) with a public IPv4
- A domain name pointing to the VPS IP (DNS `A` record)
- Ports `80` and `443` open on the VPS firewall / security group
- Docker + Docker Compose installed on the VPS

## 2) Prepare env file on the server

On the VPS, in the project root:

```bash
cp .env.production.example .env.production
```

Edit `.env.production` and fill:

- `DOMAIN` (your domain)
- `CADDY_EMAIL`
- `POSTGRES_PASSWORD` (strong password)
- `NEXT_PUBLIC_AMAP_KEY`, `NEXT_PUBLIC_AMAP_SECURITY`, `AMAP_WEB_KEY`, `SERPAPI_KEY`
- (optional) `DATABASE_URL` if using external Postgres

## 3) Start services

```bash
docker compose --env-file .env.production up -d --build
docker compose ps
```

Logs:

```bash
docker compose logs -f --tail=200 web
docker compose logs -f --tail=200 caddy
```

## 4) Migrate your existing local Docker Postgres data to the VPS

### 4.1 Create a dump from your local DB

On your **local machine** (replace `<local_db_container>` / user / db):

```bash
docker exec -t <local_db_container> pg_dump -U combmap -d combmap -Fc > combmap.dump
```

### 4.2 Copy dump to the VPS

```bash
scp combmap.dump <ssh_user>@<server_ip>:/tmp/combmap.dump
```

### 4.3 Restore into the VPS DB container

On the **VPS**, in the project root:

```bash
cat /tmp/combmap.dump | docker compose --env-file .env.production exec -T db pg_restore -U "${POSTGRES_USER:-combmap}" -d "${POSTGRES_DB:-combmap}" --clean --if-exists
```

If you prefer not to drop existing objects, remove `--clean --if-exists`.

## 5) Verify

- Open `https://$DOMAIN`
- Verify API works (login/register/me pages)
- Verify DB mode is enabled by setting `DATABASE_URL` (defaults to the local `db` service in `docker-compose.yml`)
