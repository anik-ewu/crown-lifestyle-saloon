import { redirect } from "next/navigation";
import { LinkButton, PageHeader, Stat } from "@/components/ui";
import { canViewDashboard, requireUser } from "@/lib/auth";
import { dayRange, dhakaDateString, money, PAYMENT_LABELS } from "@/lib/format";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await requireUser();
  if (!canViewDashboard(ctx)) redirect("/billing/new");
  const today = dayRange(dhakaDateString());

  const [sales, byMethod, customers] = await Promise.all([
    ctx.db.invoice.aggregate({ where: { status: "PAID", createdAt: today }, _sum: { total: true }, _count: true }),
    ctx.db.payment.groupBy({
      by: ["method"],
      where: { invoice: { status: "PAID", createdAt: today } },
      _sum: { amount: true },
    }),
    ctx.db.customer.count({ where: { deletedAt: null } }),
  ]);

  return (
    <>
      <PageHeader title="Today" actions={<LinkButton href="/billing/new" variant="gold">New bill</LinkButton>} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Sales today" value={money(sales._sum.total ?? 0)} />
        <Stat label="Bills today" value={sales._count} />
        <Stat label="Customers" value={customers} />
      </div>
      {byMethod.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-5">
          {byMethod.map((m) => <Stat key={m.method} label={PAYMENT_LABELS[m.method]} value={money(m._sum.amount ?? 0)} />)}
        </div>
      )}
    </>
  );
}
