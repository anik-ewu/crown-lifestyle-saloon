# Salon Manager

Customer, billing and sales management website for salons in Bangladesh, sold as a subscription. The first client is Crown LifeStyle Saloon (Banasree, Dhaka). The product name is a placeholder: set `NEXT_PUBLIC_APP_NAME` to change it. The full spec is in [SPEC.md](SPEC.md).

**Stack:** Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS · PostgreSQL · Prisma 7 · Recharts

## Run it locally

You need Node 20+ and Docker.

```bash
cp .env.example .env          # then set PLATFORM_OWNER_* and PLATFORM_ADMIN_PHONES
docker compose up -d          # Postgres 16 on localhost:5432
npm install
npx prisma migrate dev        # create tables
npm run db:seed               # your workspace ("Salon Manager HQ") and your owner login
npm run dev                   # http://localhost:3000
```

Sign in with `PLATFORM_OWNER_PHONE` and `PLATFORM_OWNER_PASSWORD`.

To test with realistic data, run `npm run db:seed -- --demo`. It only works against a local database. It adds Crown LifeStyle Saloon as a client salon on Pro, free for 12 months, with 4 staff, 60 customers and about 15 months of bills. Sign in to it with `DEMO_CROWN_OWNER_PHONE` and `DEMO_CROWN_OWNER_PASSWORD`.

To create or reset another local login, run `DEV_PHONE=01XXXXXXXXX DEV_PASSWORD=... DEV_ROLE=SUB_ADMIN npx tsx scripts/dev-user.ts`.

## Running it as a business

There are three kinds of login:
- **You, the platform owner.** You see every salon at **Platform**.
- **Each salon's admin.**
- **That salon's sub-admins.**

**Onboard a new salon**
1. Sign in and open **Platform → Add salon**.
2. Enter the salon's name, address and phone, the owner's name and mobile, and the plan with its paid/free-until date.
3. Give the owner the one-time password shown. They sign in with their mobile, choose their own password, and add their staff under **Settings → Sub-admins**.
- The salon gets its own "Main" branch and starter services. Its data is completely separate from every other salon's.

**Add a branch to a salon**
- The salon's admin goes to **Settings → Branches → Add branch**.
- Customers, services and prices are shared by all branches. Bills, appointments and expenses are recorded per branch.
- Sub-admins can be pinned to one branch. Admins switch branch from the sidebar.
- Limits by plan: Trial and Basic allow 1 branch, Pro allows 5.

**Subscriptions**

| Plan | Price | Sub-admins | Branches |
|---|---|---|---|
| Trial | free, 14 days | 2 | 1 |
| Basic | ৳1,500/month | 3 | 1 |
| Pro | ৳3,000/month | 15 | 5 |

- **Paying:** the salon admin pays by bKash to `PLATFORM_BKASH_NUMBER` and enters the TrxID under **Settings → Plan & payment**.
- **Approving:** you approve it on **Platform**, which extends their paid-until date.
- **Free periods:** on **Platform**, choose a plan and a "paid/free until" date. Crown is set this way: Pro, free until a date you choose.
- **Lapsed plans:** 7 days after the date passes, the salon becomes read-only. They can view and export their data, but saving is blocked.
- **Locked-out owners:** **Reset owner password** on **Platform** gives them a new one-time password.
- **Self sign-up:** set `ALLOW_SIGNUP=true` to open `/signup` for salons to start a trial themselves. It is off by default.

## Features

- **Daily use:** billing with services, packages, custom packages and products; discounts and split payments; loyalty points; printable receipts (58/80 mm/A4); WhatsApp receipts; appointments; customer history.
- **Follow-up:** a reminder board for customers with no visit in 90+ days (call, snooze, archive), and a birthday list.
- **Reports:** a sales dashboard by month or year, by item, salon member, payment method and branch; commission; expenses and profit; daily closing; CSV export.
- **Admin:** sub-admins with temporary passwords, branches, audit log, two-step sign in.
- **Platform:** add salons, set plans and free periods, approve bKash payments, reset owner passwords.

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

See SPEC.md §7a. In short:
1. Create a Neon Postgres database in the Singapore region.
2. Import the repo into Vercel and set `DATABASE_URL`, `NEXT_PUBLIC_APP_NAME`, `PLATFORM_ADMIN_PHONES` and `PLATFORM_BKASH_NUMBER`.
3. After the first deploy, run `npm run db:seed` once against the production database, with `PLATFORM_OWNER_*` set in your shell.
4. Sign in and add Crown from **Platform → Add salon**.
