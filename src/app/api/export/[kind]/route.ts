import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { getContext } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { dhakaDateString, displayPhone, monthRange, yearRange } from "@/lib/format";
import { salesByItem, salesByStaff } from "@/lib/reports";

const taka = (poisha: number) => (poisha / 100).toFixed(2);

export async function GET(req: NextRequest, { params }: RouteContext<"/api/export/[kind]">) {
  const ctx = await getContext();
  if (!ctx || ctx.user.mustChangePassword) return new NextResponse("Not signed in", { status: 401 });
  if (!ctx.isAdmin) return new NextResponse("Admins only", { status: 403 });
  const { kind } = await params;
  const sp = req.nextUrl.searchParams;
  const [ty, tm] = dhakaDateString().split("-").map(Number);
  const year = Number(sp.get("y")) || ty;
  const month = Number(sp.get("m")) || tm;
  const period = sp.get("period") === "year" ? "year" : "month";
  const range = period === "year" ? yearRange(year) : monthRange(year, month);
  const label = period === "year" ? `${year}` : `${year}-${String(month).padStart(2, "0")}`;

  let csv: string;
  let name: string;
  if (kind === "items") {
    const rows = await salesByItem(ctx, range);
    csv = toCsv(["Item", "Type", "Sold", "Revenue (BDT)"], rows.map((r) => [r.name, r.itemType, r.qty, taka(r.revenue)]));
    name = `sales-by-item-${label}`;
  } else if (kind === "staff") {
    const rows = await salesByStaff(ctx, range);
    csv = toCsv(["Member", "Services", "Revenue (BDT)"], rows.map((r) => [r.name ?? "Not set", r.services, taka(r.revenue)]));
    name = `sales-by-member-${label}`;
  } else if (kind === "invoices") {
    const rows = await ctx.db.invoice.findMany({
      where: { createdAt: range },
      orderBy: { createdAt: "asc" },
      include: { customer: true, payments: true, items: true },
    });
    csv = toCsv(
      ["Number", "Date", "Customer", "Phone", "Items", "Subtotal", "Discount", "Total", "Payment", "Status"],
      rows.map((i) => [
        i.number,
        i.createdAt.toISOString(),
        i.customer.name,
        i.customer.deletedAt ? "" : displayPhone(i.customer.phone),
        i.items.map((x) => x.nameSnapshot).join("; "),
        taka(i.subtotal),
        taka(i.discountAmount),
        taka(i.total),
        i.payments.filter((p) => p.amount > 0).map((p) => `${p.method} ${taka(p.amount)}`).join("; "),
        i.status,
      ]),
    );
    name = `invoices-${label}`;
  } else if (kind === "customers") {
    const rows = await ctx.db.customer.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
    csv = toCsv(
      ["Name", "Phone", "Address", "Status", "Last visit"],
      rows.map((c) => [c.name, displayPhone(c.phone), c.address, c.status, c.lastVisitAt?.toISOString().slice(0, 10)]),
    );
    name = "customers";
  } else {
    return new NextResponse("Unknown export", { status: 404 });
  }

  await audit(ctx, "export", kind, undefined, { period: label });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
