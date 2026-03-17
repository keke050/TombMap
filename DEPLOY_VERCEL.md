# Deploy publicly without a VPS (Vercel + managed Postgres)

This repo is a Next.js app with API routes (`app/api/*`). For a public website that stays online when your computer is off, deploy the web app to Vercel and use a managed Postgres database (Neon/Supabase/etc.).

## 1) Create a managed Postgres

- Create a database on a managed provider.
- Copy the connection string as `DATABASE_URL`.
- Prefer a URL that enforces TLS, e.g. ends with `?sslmode=require` if your provider recommends it.

## 2) Migrate your existing local Docker Postgres data

### 2.1 Dump from your local container

Your local DB container is `combmap-pg` (adjust if different):

```bash
docker exec combmap-pg sh -lc 'pg_dump -U postgres -d combmap -Fc -f /tmp/combmap.dump'
docker cp combmap-pg:/tmp/combmap.dump ./combmap.dump
ls -lh combmap.dump
```

### 2.2 Restore into managed Postgres (no local tools required)

Create a local file `.env.restore` (do not commit it) containing:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require
```

Then restore:

```bash
set -a
. ./.env.restore
set +a

cat combmap.dump | docker run --rm -i postgres:16-alpine \
  pg_restore -d "$DATABASE_URL" --clean --if-exists --no-owner --no-privileges
```

Verify:

```bash
docker run --rm -i postgres:16-alpine psql "$DATABASE_URL" -c "\dt public.*"
docker run --rm -i postgres:16-alpine psql "$DATABASE_URL" -c "select count(*) from public.users;"
```

## 3) Deploy to Vercel

1. Push this repo to GitHub/GitLab.
2. Create a Vercel project and import the repo.
3. In Vercel Project Settings → Environment Variables, set:
   - `DATABASE_URL`
   - `NEXT_PUBLIC_AMAP_KEY`
   - `NEXT_PUBLIC_AMAP_SECURITY`
   - `AMAP_WEB_KEY`
   - `SERPAPI_KEY`
4. Deploy.

## Notes

- Vercel cannot connect to `localhost` databases. Your `DATABASE_URL` must be reachable from the internet.
- Keep local and production DB URLs separate: use `.env.local` for local dev, and Vercel environment variables for production.
- Some managed pooler endpoints use an empty `search_path`. This repo uses `public.<table>` in SQL so it works even when `search_path` is empty.
