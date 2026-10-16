# Crown LifeStyle Saloon — Product Spec

## 1. Goal
A **website** that staff open in a browser, mainly on the front-desk PC or laptop. No native mobile app and no app-store install. The layout adjusts to smaller screens so the admin can also check it from a phone browser. It lets a salon:
- keep a customer register, keyed by phone number
- record every visit: services or packages taken, which staff member did them, and what was paid
- print an invoice at billing time
- see monthly and yearly sales per service
- find customers who haven't visited in 3+ months so someone can call them

Non-goals for v1: a native Android/iOS app, online booking by customers, a customer-facing portal, automated SMS/WhatsApp, accounting.

## 1a. Salon profile (first tenant, used as seed data)
| Field | Value |
|---|---|
| Name | Crown LifeStyle Saloon |
| Address | A.K Haris Villa, House #02, Road #03, Block #F, Banasree, Rampura, Dhaka-1219, Bangladesh |
| Phone | +880 1906-336438 |
| Email | crownlifestylesaloon@gmail.com |
| Facebook | facebook.com/profile.php?id=61591904007465 |
| Social | TikTok (link to be added in settings) |
| Hours | Sun–Wed & Fri 10:00 AM – 10:00 PM; Thu & Sat 10:00 AM – 11:00 PM |
| Market | Bangladesh only: currency BDT (৳), timezone Asia/Dhaka, phone format +880, **no VAT** |
| Branding | Logo/cover from `assets/profile-picture.jpg` and `assets/cover-photo.jpg` |

- Address, phone and Facebook are printed on every invoice header and footer.
- **Opening hours** are stored in settings (one row per weekday). They're used to define the business day for the daily closing report, so a bill at 10:45 PM on Thursday counts toward Thursday. All dates are stored in UTC and shown in Asia/Dhaka time.

## 2. Users & roles
| Role | Login | Can do |
|---|---|---|
| **Admin** (owner) | Phone **or** email + password (2FA optional) | Everything |
| **Sub-admin** (front desk / manager) | Phone + password | Daily operations only (see matrix) |
| **Salon member** (stylist/barber) | No login in v1 | Only appears as "served by" on visits and reports |

**Adding a sub-admin:** the admin enters the sub-admin's name and phone number, and the system creates a one-time temporary password. The admin passes it on in person or by phone. The sub-admin must set a new password at first login. Sub-admins can be deactivated, which ends their sessions immediately, but never hard-deleted, so the audit trail stays intact. An SMS OTP invite is a later option.

### Permission matrix
| Action | Admin | Sub-admin |
|---|---|---|
| Add / edit customer | ✅ | ✅ |
| Record visit, bill, print invoice | ✅ | ✅ |
| Apply discount | ✅ | ✅ up to a limit the admin sets (e.g. 10%) |
| Edit / void a past invoice | ✅ | ❌ (can only request a void) |
| Reminder board: log call, snooze, archive | ✅ | ✅ |
| Delete customer | ✅ | ❌ |
| Services, packages, prices | ✅ | ❌ |
| Salon members (staff) | ✅ | ❌ |
| Sales dashboard | ✅ | ❌ by default (admin can turn it on) |
| Manage sub-admins, settings, audit log | ✅ | ❌ |

## 3. Features (v1)

### 3.1 Customers
- Fields: **phone** (unique per salon, normalised to E.164 format such as +8801XXXXXXXXX), name, address, and optionally gender, date of birth, notes (for example allergies or preferred stylist), and status (`active | snoozed | archived`).
- Search by phone or name. Phone is the main lookup at the counter: typing the number shows the customer straight away, or offers to create them.
- **Customer detail page:** profile at the top, then a visit history list, newest first. Each row shows date, services or packages, staff member, amount, payment method, and an invoice link. Also shows totals: lifetime spend, number of visits, last visit date.

### 3.2 Visits & billing (the main daily screen)
1. Find or create the customer by phone.
2. Add line items, each a **service** or **package**, and pick the **salon member** for each item (different items can have different staff).
3. Discount (flat amount or %), with an optional note. **No VAT or service charge**, so total = subtotal − discount.
4. Payment method: Cash / Card / bKash / Nagad / Other, with split payments allowed.
5. Save. This creates an invoice with a sequential number (e.g. `CLS-2026-000123`) and opens the **print view**.
- **Prices are copied onto each line item when billed**, so changing a price later never changes old invoices or reports.
- Invoices are never deleted. Admin can **void** one (a reason is required); voided invoices are left out of sales totals.

### 3.3 Invoice printing
- A browser print view with three layouts: **58 mm** and **80 mm thermal receipt**, plus **A4**. The default is chosen in settings, since the printer hasn't been bought yet. Receipt layouts are a single narrow column, so either paper width works.
- Shows salon name, logo, address and phone, invoice number, date, customer name and phone, line items with staff, subtotal, discount, total, paid, payment method, and a footer note.
- Uses the browser's print dialog only, with no extra print software, which keeps it simple. A PDF can be saved from the same dialog.

### 3.4 Catalog: services & packages (admin)
- **Service:** name, category (Hair, Beard, Skin, Spa…), price, duration (optional), active flag.
- **Package:** a named bundle of services with one package price (e.g. "Groom Package").
- **Custom package:** built while billing by picking services and setting a price. It can optionally be saved to the catalog for reuse.
- Price updates are recorded in a price-history table, so there's a record of who changed what and when.

### 3.5 Salon members (staff) — admin
- Name, phone, role/title, active flag. Removing a member just deactivates them, so their past visits still show their name.

### 3.6 Sales dashboard (admin)
- Choose a period: this month, a chosen month, or a chosen year.
- Cards: total revenue, number of invoices, average bill, new vs returning customers.
- **Sales by item:** a table and bar chart per service or package, showing quantity and revenue, for the month and the year.
- Monthly trend: revenue by month for the year (line or bar chart).
- Revenue by staff member, which also feeds a future commission feature.
- Export any table to CSV.

### 3.7 Reminder board (lapsed customers)
- **Due list:** `status = active` and last visit more than **90 days** ago (the number of days can be changed in settings). Sorted by how long it's been since the last visit.
- Each row shows name, phone (a clickable `tel:` link), last visit, last services, and lifetime spend.
- Actions:
  - **Called → snooze 3 months:** logs the call with an outcome (reached / no answer / will come / other) and a note, and sets `snoozed_until = today + 90 days`. The customer returns to the list automatically after that date if they still haven't visited.
  - **Archive:** with a reason (moved away / not interested / other). Hidden from the board but kept in history, and can be restored.
  - **Delete:** admin only. Soft-deleted: personal data is anonymised and the visits are kept for sales totals.
- Any new visit automatically sets a snoozed customer back to active.
- A call log appears on the customer page.

### 3.8 Settings & audit (admin)
- Salon profile (name, logo, address, phone, invoice footer), currency (BDT ৳), default receipt width (58/80 mm/A4), reminder days, sub-admin discount limit, sub-admin dashboard access.
- **Audit log:** who did what and when, for sign-ins, price changes, voids, deletes, discounts over the limit, and sub-admin changes. It cannot be edited from the UI.

## 4. Suggested extra features (later, in priority order)
1. **Daily closing report:** today's cash, card and bKash totals, number of invoices, and voids, to compare against the cash drawer.
2. **Staff commission report:** a % per service or per member, calculated from visits.
3. **Customer notes & preferences:** for example a hair colour formula, favourite stylist, or allergies, shown during billing.
4. **Birthday list:** customers whose birthdays are this week, for a call or an offer.
5. **Loyalty:** for example every 10th haircut free, or points per ৳100 spent.
6. **Appointments / walk-in queue:** a simple booking calendar for each staff member.
7. **Expenses:** rent, products, and salaries, giving a simple profit view (revenue − expenses).
8. **SMS / WhatsApp:** receipt after billing, and automatic reminder messages to replace manual calls (BD SMS gateway or WhatsApp Business API).
9. **Product sales & stock:** retail items such as wax or shampoo, with low-stock alerts.
10. **Multi-branch:** planned. The data model includes branches from day one (see §6), so this only adds a branch switcher, branch-level reports, and assigning sub-admins and staff to branches.

## 5. Tech stack (simple, one codebase)
| Layer | Choice | Why |
|---|---|---|
| App | **Next.js (App Router) + TypeScript** | Frontend and backend in one repo and one deploy. Server Actions handle forms without a separate API. |
| UI | **Tailwind CSS** with a small set of in-house components (`src/components/ui.tsx`), **Recharts** for charts | No component library to keep updated; plain HTML forms + Server Actions |
| DB | **PostgreSQL** (managed: **Neon** or Supabase) | Relational data with joins for reports, built-in backups and point-in-time restore, free tier to start |
| ORM | **Prisma** | Type-safe queries, managed migrations, easy to read |
| Auth | **Built in** (`src/lib/auth.ts`): scrypt password hashes, random session tokens stored hashed in Postgres, TOTP 2FA | About 200 lines with no third-party auth service. Phone-first logins and admin-created accounts don't fit an email-first library well |
| Validation | **Zod** | One schema for both form and server checks |
| Hosting | **Vercel Hobby (free)** (app) + **Neon free** (DB) for the personal trial. Upgrade to Vercel Pro + Neon paid later | ৳0 to start, no servers to look after. See §7a |
| Errors | Sentry (free tier) | Shows when something breaks |

## 6. Data model (core tables)
Every business table has `salon_id`, which makes the app multi-tenant from day one and allows a SaaS later at no extra cost.

```
salon(id, name, logo_url, phone, currency, settings_json, plan, status, created_at)
branch(id, salon_id, name, address, phone, opening_hours_json, active)   -- v1: one branch (Banasree)
user(id, salon_id, branch_id?, name, phone, email?, password_hash, role[admin|sub_admin], active,
     must_change_password, two_factor_enabled, last_login_at)
session(...)                     -- managed by auth library
staff_member(id, salon_id, branch_id, name, phone, title, active)
customer(id, salon_id, phone, name, address, gender?, dob?, notes, status[active|snoozed|archived],
         snoozed_until?, archived_reason?, last_visit_at, deleted_at?)   UNIQUE(salon_id, phone)
service(id, salon_id, name, category, price, duration_min?, active)
package(id, salon_id, name, price, is_custom, active)
package_item(package_id, service_id, qty)
price_history(id, salon_id, item_type, item_id, old_price, new_price, changed_by, changed_at)
invoice(id, salon_id, branch_id, number, customer_id, created_by, subtotal, discount_type, discount_value,
        total, status[paid|void], void_reason?, voided_by?, created_at)
invoice_item(id, invoice_id, item_type[service|package], item_id, name_snapshot,
             unit_price_snapshot, qty, staff_member_id, line_total)
payment(id, invoice_id, method[cash|card|bkash|nagad|other], amount)
reminder_log(id, salon_id, customer_id, called_by, outcome, note, snoozed_until?, created_at)
audit_log(id, salon_id, user_id, action, entity, entity_id, meta_json, ip, created_at)
```
- **Branches:** customers, the catalog and prices belong to the salon and are shared by all branches. Invoices, staff and sub-admins belong to a branch (a sub-admin with no branch can work at all of them). v1 creates one branch and hides the branch UI.
- Money is stored as integers (poisha) or `numeric(12,2)`, never floats.
- `customer.last_visit_at` is updated whenever an invoice is saved, which keeps the reminder board query cheap.
- Indexes: `(salon_id, phone)`, `(salon_id, last_visit_at)`, `(salon_id, created_at)` on invoice.

## 7. Security
- **Auth:** passwords hashed with scrypt (N=2^16). Sessions use httpOnly, Secure, SameSite=Lax cookies. Login attempts are rate-limited and locked after 5 failures. Admin 2FA (TOTP) is optional. Deactivating a user ends all of their sessions.
- **Authorization:** every server action checks the session and role, and **always filters by `session.salon_id`**. All database access goes through one helper (e.g. `db.forSalon(salonId)`), so a query can never be missing the tenant filter. Postgres Row-Level Security is a second safety layer to add before going SaaS.
- **Input:** Zod checks every input on the server, and Prisma parameterises queries, so there's no SQL injection. React escapes output, and a CSP header helps against XSS. Server Actions have built-in CSRF protection.
- **Data:** TLS everywhere. The managed database encrypts data at rest, with daily backups plus point-in-time restore. A monthly restore test is on the checklist. Secrets live only in environment variables, never in git.
- **Privacy:** only the minimum personal data is stored (phone, name, address). Customer delete anonymises personal data. Exports are admin only and logged.
- **Operations:** audit log, dependency updates (Dependabot), HTTPS-only, and security headers (HSTS, X-Frame-Options, etc.).

## 7a. Environments & deployment (free first)

**Goal: run at ৳0 per month while the owner tries it in production personally (non-commercial), then move to paid plans without changing any code.**

| | Local dev | Production (free stage) | Production (paid, later) |
|---|---|---|---|
| App | `npm run dev` on Mac | **Vercel Hobby** (`*.vercel.app` subdomain) | **Vercel Pro** + own domain |
| DB | Postgres 16 in **Docker** (`docker compose up -d`) | **Neon free**, `main` branch | Neon paid (longer restore window, more storage) |
| Data | Fake seed data only | Test data during the trial | Real customers |

- **Vercel Hobby is for non-commercial use only.** That fits the trial, where the owner tests it alone with no real salon business running on it. **Upgrade to Vercel Pro (about $20 a month) before the salon starts billing real customers on it.**
- **Keep the code host-neutral:** no host-specific APIs. Everything comes from environment variables (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`), so changing host means re-importing the repo and copying those variables over.
- **Region:** put the Neon database in the **same region as the app's server functions**. Each page makes several database queries, so the distance between app and database matters more than the distance from Dhaka.
- **Deploy flow:** push to GitHub, and the host builds with `prisma migrate deploy && next build`. Every branch gets a preview URL; merging to `main` updates the live site. Preview builds use a separate Neon `dev` branch, never production data.
- **First admin:** a one-time seed script creates the salon, the Banasree branch and the owner's admin account.
- **Free-tier limits to know:**
  - Neon free: about 0.5 GB of storage, which is years of salon data. The database sleeps after about 5 minutes idle, so the first request takes about 1 second longer. The restore window is short.
  - The free app host has monthly limits on build minutes and function calls. One salon uses a tiny fraction of them.
- **Free backups (needed, since Neon free's restore window is short):** a nightly **GitHub Actions** job runs `pg_dump`, encrypts the file with `age`, and keeps it as a private build artifact (about 90-day retention). It stays inside the 2,000 free Actions minutes a month. Do a test restore to local Docker once a month.
- **Free monitoring:** Sentry free tier for errors, and UptimeRobot free tier to send an alert if the site goes down.
- **Move to paid when:** the trial is over and the salon starts using it for real billing (required by Vercel's terms), you want a custom domain or longer backups, or you start selling the subscription (§8). Expected cost then: about $20–40 a month plus the domain.

## 8. Subscription / SaaS (optional, phase 3)
This is already possible because of `salon_id` on every table. To add:
- Public sign-up: a salon owner creates a salon and becomes its admin.
- `salon.plan` (Free trial / Basic / Pro) with limits such as number of sub-admins, branches, SMS credits, and reports.
- **Bangladesh only.** Billing through **bKash** (recurring/tokenized) or **SSLCommerz** (cards, Nagad, bank). Prices are in BDT, and there is no Stripe or multi-currency. A webhook updates `salon.status`. Past-due salons become read-only.
- A super-admin panel for the platform owner, showing salons, plans and usage.
- Postgres RLS turned on, plus per-salon rate limits.

## 9. Pages
`/login` · `/dashboard` (sales) · `/billing/new` · `/invoices/[id]` (+ `/print`) · `/customers` · `/customers/[id]` · `/reminders` · `/catalog/services` · `/catalog/packages` · `/staff` · `/settings` (salon, sub-admins, audit log)
This is a desktop-first website. The pages also work in a phone browser, where phone numbers become tap-to-call `tel:` links, but there is no separate mobile app.

## 10. Phases
- **Phase 1 (MVP):** auth (admin + sub-admin), customers, catalog, staff, billing + print invoice, customer history.
- **Phase 2:** sales dashboard, reminder board, audit log, CSV export, daily closing report.
- **Phase 3:** extras from §4, then SaaS (§8).

## 10a. Build status (17 Oct 2026)

All three phases are built:

- **Phase 1:** sign-in, sub-admins, customers, services, packages (including custom ones), salon members, billing, receipts, voids
- **Phase 2:** sales dashboard, reminder board, audit log, CSV export, daily closing, two-step sign in
- **Phase 3 extras:** commission, birthdays with WhatsApp wishes, loyalty points, appointments, expenses with a profit view, WhatsApp click-to-chat links for receipts and reminders, products and stock, multiple branches
- **Phase 3 SaaS:** public sign-up (`ALLOW_SIGNUP`), plans with limits, bKash payments by transaction ID that the platform owner approves, a platform panel (`PLATFORM_ADMIN_PHONES`), and read-only mode when a plan lapses

Not built yet:

- **Automatic bKash/SSLCommerz gateway.** Payments are confirmed by hand from the transaction ID.
- **SMS gateway.** Messages use free WhatsApp links instead.
- **Postgres Row-Level Security.** The tenant filter in `forSalon()` is enforced in code.
- **Bangla interface.**

## 11. Decisions
| Question | Decision |
|---|---|
| VAT / service charge | None. Invoice total = subtotal − discount. |
| Branches | One branch now (Banasree). More may open later, so the data model includes `branch` from day one. |
| Receipt printer | Not bought yet. Support 58 mm, 80 mm and A4, with the default chosen in settings. |
| Existing customer data | Entered by hand through the normal "add customer" form. No import tool in v1. |
| Hosting budget | Free personal trial on Vercel Hobby + Neon free + GitHub Actions backups. Vercel Pro once used commercially. See §7a. |
| SaaS market | Bangladesh only: BDT, bKash/SSLCommerz, Bangla UI option later. |
