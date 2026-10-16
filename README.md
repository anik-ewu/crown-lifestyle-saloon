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

## Features

- **Daily use:** billing with services, packages, custom packages and products; discounts and split payments; loyalty points; printable receipts (58/80 mm/A4); WhatsApp receipts; appointments; customer history.
- **Follow-up:** a reminder board for customers with no visit in 90+ days (call, snooze, archive), and a birthday list.
- **Reports:** a sales dashboard by month or year, by item, salon member, payment method and branch; commission; expenses and profit; daily closing; CSV export.
- **Admin:** sub-admins with temporary passwords, branches, audit log, two-step sign in.
- **Subscription (optional):** set `ALLOW_SIGNUP=true` so other salons can start a 14-day trial. They pay by bKash and enter the TrxID. A platform admin (`PLATFORM_ADMIN_PHONES`) approves the payment at `/platform`. A salon whose plan lapses becomes read-only after 7 days' grace. Crown's own salon is on the `INTERNAL` plan and never expires.

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
- Logins lock for 15 minutes after 5 wrong passwords, and failed attempts are also rate-limited per IP. Any user can turn on two-step sign in (an authenticator app code) from **My account**. `npx tsx --conditions=react-server scripts/check-totp.ts` checks the code generator against the RFC 6238 test vectors.
- CSV exports are admin-only, recorded in the audit log, and protected against spreadsheet formula injection.
- Sessions are httpOnly cookies, and only a hash of each token is stored.
- Security headers, including a CSP, are set in `next.config.ts`.

## Deploy

See SPEC.md §7a. In short: create a Neon Postgres database in the Singapore region, then import the repo into Vercel and set `DATABASE_URL`. After the first deploy, run `npm run db:seed` once against the production database, with `SEED_ADMIN_*` set in your shell.
