import "server-only";
import type { Ctx } from "@/lib/auth";

// Raw SQL bypasses forSalon(), so every query below filters "salonId" itself.
// Timestamps are stored as UTC; reports group by Dhaka local time.

export type Range = { gte: Date; lt: Date };
const LOCAL = `("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Dhaka')`;

export async function salesSummary(ctx: Ctx, r: Range) {
  const [row] = await ctx.db.$queryRawUnsafe<{ revenue: number; bills: number; discounts: number }[]>(
    `SELECT COALESCE(SUM(total),0)::float8 AS revenue, COUNT(*)::int AS bills, COALESCE(SUM("discountAmount"),0)::float8 AS discounts
       FROM "Invoice" WHERE "salonId" = $1 AND status = 'PAID' AND "createdAt" >= $2 AND "createdAt" < $3`,
    ctx.salon.id, r.gte, r.lt,
  );
  const [cust] = await ctx.db.$queryRawUnsafe<{ new_customers: number; returning: number }[]>(
    `WITH visitors AS (
        SELECT DISTINCT "customerId" FROM "Invoice"
         WHERE "salonId" = $1 AND status = 'PAID' AND "createdAt" >= $2 AND "createdAt" < $3),
      firsts AS (
        SELECT "customerId", MIN("createdAt") AS first_at FROM "Invoice"
         WHERE "salonId" = $1 AND status = 'PAID' AND "customerId" IN (SELECT "customerId" FROM visitors)
         GROUP BY 1)
     SELECT COUNT(*) FILTER (WHERE first_at >= $2)::int AS new_customers,
            COUNT(*) FILTER (WHERE first_at < $2)::int AS returning
       FROM firsts`,
    ctx.salon.id, r.gte, r.lt,
  );
  return { ...row, avg: row.bills ? row.revenue / row.bills : 0, ...cust };
}

export type ItemRow = { itemType: "SERVICE" | "PACKAGE"; itemId: string; name: string; qty: number; revenue: number };

/** Revenue per service/package, before bill-level discounts. */
export async function salesByItem(ctx: Ctx, r: Range, branchId?: string) {
  return ctx.db.$queryRawUnsafe<ItemRow[]>(
    `SELECT ii."itemType" AS "itemType", ii."itemId" AS "itemId",
            (ARRAY_AGG(ii."nameSnapshot" ORDER BY i."createdAt" DESC))[1] AS name,
            SUM(ii.qty)::int AS qty, SUM(ii."lineTotal")::float8 AS revenue
       FROM "InvoiceItem" ii JOIN "Invoice" i ON i.id = ii."invoiceId"
      WHERE i."salonId" = $1 AND i.status = 'PAID' AND i."createdAt" >= $2 AND i."createdAt" < $3
        ${branchId ? `AND i."branchId" = $4` : ""}
      GROUP BY 1, 2 ORDER BY revenue DESC`,
    ...[ctx.salon.id, r.gte, r.lt, ...(branchId ? [branchId] : [])],
  );
}

export type StaffRow = { staffId: string | null; name: string | null; services: number; revenue: number };

export async function salesByStaff(ctx: Ctx, r: Range) {
  return ctx.db.$queryRawUnsafe<StaffRow[]>(
    `SELECT ii."staffMemberId" AS "staffId", s.name AS name,
            SUM(ii.qty)::int AS services, SUM(ii."lineTotal")::float8 AS revenue
       FROM "InvoiceItem" ii JOIN "Invoice" i ON i.id = ii."invoiceId"
       LEFT JOIN "StaffMember" s ON s.id = ii."staffMemberId"
      WHERE i."salonId" = $1 AND i.status = 'PAID' AND i."createdAt" >= $2 AND i."createdAt" < $3
      GROUP BY 1, 2 ORDER BY revenue DESC`,
    ctx.salon.id, r.gte, r.lt,
  );
}

export async function salesByMethod(ctx: Ctx, r: Range) {
  return ctx.db.$queryRawUnsafe<{ method: string; amount: number }[]>(
    `SELECT p.method::text AS method, SUM(p.amount)::float8 AS amount
       FROM "Payment" p JOIN "Invoice" i ON i.id = p."invoiceId"
      WHERE i."salonId" = $1 AND i.status = 'PAID' AND i."createdAt" >= $2 AND i."createdAt" < $3 AND p.amount > 0
      GROUP BY 1 ORDER BY amount DESC`,
    ctx.salon.id, r.gte, r.lt,
  );
}

/** Revenue per local-time bucket ('day' within a month, 'month' within a year). */
export async function revenueSeries(ctx: Ctx, r: Range, bucket: "day" | "month") {
  const part = bucket === "day" ? "day" : "month";
  const rows = await ctx.db.$queryRawUnsafe<{ k: number; revenue: number; bills: number }[]>(
    `SELECT EXTRACT(${part} FROM ${LOCAL})::int AS k, SUM(total)::float8 AS revenue, COUNT(*)::int AS bills
       FROM "Invoice" WHERE "salonId" = $1 AND status = 'PAID' AND "createdAt" >= $2 AND "createdAt" < $3
      GROUP BY 1 ORDER BY 1`,
    ctx.salon.id, r.gte, r.lt,
  );
  return new Map(rows.map((x) => [x.k, x]));
}
