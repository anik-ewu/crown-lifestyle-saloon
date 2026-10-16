import { Button, Empty, PageHeader, Select, Table } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { dhakaDateString, money, monthRange } from "@/lib/format";
import { salesByStaff } from "@/lib/reports";

export const metadata = { title: "Commission" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function CommissionPage({ searchParams }: PageProps<"/reports/commission">) {
  const ctx = await requireAdmin();
  const sp = await searchParams;
  const [ty, tm] = dhakaDateString().split("-").map(Number);
  const year = Number(sp.y) || ty;
  const month = Math.min(12, Math.max(1, Number(sp.m) || tm));
  const rows = (await salesByStaff(ctx, monthRange(year, month))).filter((r) => r.staffId);
  const total = rows.reduce((s, r) => s + Math.round((r.revenue * (r.commissionPct ?? 0)) / 100), 0);

  return (
    <>
      <PageHeader
        title="Commission"
        description="Each member's share of the services and products they served, at the % set on Salon members. Based on line prices before bill discounts."
      />
      <form className="mb-4 flex gap-2">
        <Select name="m" defaultValue={month} className="w-auto" aria-label="Month">
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </Select>
        <Select name="y" defaultValue={year} className="w-auto" aria-label="Year">
          {[ty, ty - 1, ty - 2].map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
        <Button variant="secondary">Show</Button>
      </form>
      {rows.length === 0 ? (
        <Empty>No services recorded with a salon member this month.</Empty>
      ) : (
        <Table>
          <thead><tr><th>Member</th><th className="text-right">Items</th><th className="text-right">Revenue</th><th className="text-right">Rate</th><th className="text-right">Commission</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.staffId}>
                <td>{r.name}</td>
                <td className="text-right tabular-nums">{r.services}</td>
                <td className="text-right tabular-nums">{money(r.revenue)}</td>
                <td className="text-right tabular-nums">{r.commissionPct ?? 0}%</td>
                <td className="text-right font-medium tabular-nums">{money(Math.round((r.revenue * (r.commissionPct ?? 0)) / 100))}</td>
              </tr>
            ))}
            <tr className="font-semibold"><td colSpan={4}>Total</td><td className="text-right tabular-nums">{money(total)}</td></tr>
          </tbody>
        </Table>
      )}
    </>
  );
}
