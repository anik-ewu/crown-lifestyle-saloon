# Crown LifeStyle Saloon

Customer, billing and sales management website for Crown LifeStyle Saloon (Banasree, Dhaka). The full product spec is in [SPEC.md](SPEC.md).

**Stack:** Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS · PostgreSQL · Prisma 7 · Recharts

## Run it locally

You need Node 20+ and Docker.

```bash
cp .env.example .env          # then set SEED_ADMIN_PHONE / SEED_ADMIN_PASSWORD
docker compose up -d          # Postgres 16 on localhost:5432
npm install
npx prisma migrate dev        # create tables
npm run db:seed               # salon, Banasree branch, owner account, starter services
npm run dev                   # http://localhost:3000
```

Sign in with `SEED_ADMIN_PHONE` and `SEED_ADMIN_PASSWORD`.

To test with realistic data, run `npm run db:seed -- --demo`. It adds 4 staff, 60 customers and about 15 months of bills, and only works against a local database.

To create or reset another local login, run `DEV_PHONE=01XXXXXXXXX DEV_PASSWORD=... DEV_ROLE=SUB_ADMIN npx tsx scripts/dev-user.ts`.

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run typecheck` / `npm run lint` | Checks |
| `npm run db:migrate -- --name <change>` | Create a migration after editing `prisma/schema.prisma` |
| `npm run db:studio` | Browse the database |
| `npm run build` | Production build (generates the client, applies migrations, builds) |

## Project layout

```
prisma/schema.prisma      data model (money in poisha, every table has salonId)
prisma/seed.ts            first salon + admin (+ --demo data)
src/lib/db.ts             Prisma client + forSalon() tenant-scoped client
src/lib/auth.ts           sessions, login rate limiting, requireUser/requireAdmin
src/app/actions/*.ts      Server Actions (all writes; each checks the session and role)
src/app/(app)/…           signed-in pages
src/app/print/…           printable receipts (58 mm / 80 mm / A4)
```

## Security notes

- Every page and action calls `requireUser()` or `requireAdmin()`.
- Database access goes through `ctx.db`, which adds `salonId` to every query.
- Prices are read from the database at billing time and never trusted from the browser.
- Logins lock for 15 minutes after 5 wrong passwords, and failed attempts are also rate-limited per IP.
- Sessions are httpOnly cookies, and only a hash of each token is stored.
- Security headers, including a CSP, are set in `next.config.ts`.

## Deploy

See SPEC.md §7a. In short: create a Neon Postgres database in the Singapore region, then import the repo into Vercel and set `DATABASE_URL`. After the first deploy, run `npm run db:seed` once against the production database, with `SEED_ADMIN_*` set in your shell.
