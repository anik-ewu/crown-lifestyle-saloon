import Link from "next/link";
import { redirect } from "next/navigation";
import { RevenueChart, type RevenuePoint } from "@/components/revenue-chart";
import { Button, Card, Empty, LinkButton, PageHeader, Select, Stat, Table } from "@/components/ui";
import { canViewDashboard, requireUser } from "@/lib/auth";
import { dayRange, dhakaDateString, money, monthRange, PAYMENT_LABELS, yearRange } from "@/lib/format";
import { revenueSeries, salesByItem, salesByMethod, salesByStaff, salesSummary } from "@/lib/reports";

export const metadata = { title: "Dashboard" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const ctx = await requireUser();
  if (!canViewDashboard(ctx)) redirect("/billing/new");
  const sp = await searchParams;

  const today = dhakaDateString();
  const [ty, tm] = today.split("-").map(Number);
  const period = sp.period === "year" ? "year" : "month";
  const year = Math.min(ty + 1, Math.max(2020, Number(sp.y) || ty));
  const month = Math.min(12, Math.max(1, Number(sp.m) || tm));
  const range = period === "year" ? yearRange(year) : monthRange(year, month);
  const title = period === "year" ? String(year) : `${MONTHS[month - 1]} ${year}`;

  const [todaySales, summary, items, staff, methods, series] = await Promise.all([
    salesSummary(ctx, dayRange(today)),
    salesSummary(ctx, range),
    salesByItem(ctx, range),
    salesByStaff(ctx, range),
    salesByMethod(ctx, range),
    revenueSeries(ctx, range, period === "year" ? "month" : "day"),
  ]);

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const points: RevenuePoint[] =
    period === "year"
      ? MONTHS.map((label, i) => ({ label, revenue: series.get(i + 1)?.revenue ?? 0, bills: series.get(i + 1)?.bills ?? 0 }))
      : Array.from({ length: daysInMonth }, (_, i) => ({
          label: String(i + 1),
          revenue: series.get(i + 1)?.revenue ?? 0,
          bills: series.get(i + 1)?.bills ?? 0,
        }));
  const itemTotal = items.reduce((s, i) => s + i.revenue, 0);
  const qs = new URLSearchParams({ period, y: String(year), m: String(month) }).toString();
  const years = Array.from({ length: ty - 2023 + 1 }, (_, i) => ty - i);

  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={
          <>
            <LinkButton href="/reports/closing" variant="secondary">Daily closing</LinkButton>
            <LinkButton href="/billing/new" variant="gold">New bill</LinkButton>
          </>
        }
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Stat label="Sales today" value={money(todaySales.revenue)} sub={`${todaySales.bills} bill${todaySales.bills === 1 ? "" : "s"}`} />
        <Stat label="New customers today" value={todaySales.new_customers} />
        <Stat label="Returning today" value={todaySales.returning} />
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <Select name="period" defaultValue={period} className="w-auto" aria-label="Period">
          <option value="month">Month</option>
          <option value="year">Year</option>
        </Select>
        <Select name="m" defaultValue={month} className="w-auto" aria-label="Month">
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </Select>
        <Select name="y" defaultValue={year} className="w-auto" aria-label="Year">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
        <Button variant="secondary">Show</Button>
        <span className="text-sm text-stone-500">Month is ignored for a yearly view.</span>
      </form>

      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Revenue" value={money(summary.revenue)} />
        <Stat label="Bills" value={summary.bills} />
        <Stat label="Average bill" value={money(Math.round(summary.avg / 100) * 100)} />
        <Stat label="New customers" value={summary.new_customers} />
        <Stat label="Returning customers" value={summary.returning} />
      </div>

      <Card title={period === "year" ? `Revenue by month, ${year}` : `Revenue by day, ${title}`} className="mb-6">
        <RevenueChart data={points} />
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-stone-500">Show as table</summary>
          <table className="mt-2 w-full max-w-sm">
            <tbody>
              {points.filter((p) => p.bills > 0).map((p) => (
                <tr key={p.label} className="border-t border-stone-100">
                  <td className="py-1">{p.label}</td>
                  <td className="text-right tabular-nums">{money(p.revenue)}</td>
                  <td className="text-right text-stone-500">{p.bills}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">Sales by service & package</h3>
            {ctx.isAdmin && <Link href={`/api/export/items?${qs}`} className="text-sm text-gold-dark hover:underline">Download CSV</Link>}
          </div>
          {items.length === 0 ? (
            <Empty>No sales in this period.</Empty>
          ) : (
            <Table>
              <thead>
                <tr><th>Item</th><th className="text-right">Sold</th><th className="text-right">Revenue</th><th className="w-1/3">Share</th></tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={`${i.itemType}${i.itemId}`}>
                    <td>{i.name} {i.itemType === "PACKAGE" && <span className="text-xs text-stone-500">package</span>}</td>
                    <td className="text-right tabular-nums">{i.qty}</td>
                    <td className="text-right tabular-nums">{money(i.revenue)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-stone-100">
                          <div className="h-2 rounded-full bg-[#a07c22]" style={{ width: `${itemTotal ? (i.revenue / itemTotal) * 100 : 0}%` }} />
                        </div>
                        <span className="w-10 text-right text-xs tabular-nums text-stone-500">{itemTotal ? Math.round((i.revenue / itemTotal) * 100) : 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <p className="mt-1 text-xs text-stone-500">Item revenue is before bill-level discounts ({money(summary.discounts)} this period).</p>
        </div>

        <div className="space-y-6">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">By salon member</h3>
              {ctx.isAdmin && <Link href={`/api/export/staff?${qs}`} className="text-sm text-gold-dark hover:underline">CSV</Link>}
            </div>
            {staff.length === 0 ? <Empty>No data.</Empty> : (
              <Table>
                <thead><tr><th>Member</th><th className="text-right">Services</th><th className="text-right">Revenue</th></tr></thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.staffId ?? "none"}>
                      <td>{s.name ?? <span className="text-stone-500">Not set</span>}</td>
                      <td className="text-right tabular-nums">{s.services}</td>
                      <td className="text-right tabular-nums">{money(s.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
          <div>
            <h3 className="mb-2 font-semibold">By payment method</h3>
            {methods.length === 0 ? <Empty>No data.</Empty> : (
              <Table>
                <tbody>
                  {methods.map((m) => (
                    <tr key={m.method}><td>{PAYMENT_LABELS[m.method]}</td><td className="text-right tabular-nums">{money(m.amount)}</td></tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
