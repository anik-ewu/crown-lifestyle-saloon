import { adjustSalonPlan, reviewSubscriptionPayment } from "@/app/actions/subscription";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, Empty, Input, PageHeader, Select, Stat, Table } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { daysAgo, formatDate, formatDateTime, money } from "@/lib/format";
import { PLANS, subscriptionState } from "@/lib/plans";

export const metadata = { title: "Platform" };

// Cross-salon view for the platform owner. Uses the unscoped client on purpose.
export default async function PlatformPage() {
  await requirePlatformAdmin();
  const since = daysAgo(30);
  const [salons, pending, activity] = await Promise.all([
    prisma.salon.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true, customers: true, branches: true } } },
    }),
    prisma.subscriptionPayment.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, include: { salon: { select: { name: true } } } }),
    prisma.invoice.groupBy({ by: ["salonId"], where: { createdAt: { gte: since }, status: "PAID" }, _count: true }),
  ]);
  const bills = new Map(activity.map((a) => [a.salonId, a._count]));
  const paying = salons.filter((s) => (s.plan === "BASIC" || s.plan === "PRO") && !subscriptionState(s).readOnly);
  const mrr = paying.reduce((sum, s) => sum + PLANS[s.plan].monthlyTaka, 0);

  return (
    <>
      <PageHeader title="Platform" description="All salons on this installation, plans and payments." />
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Salons" value={salons.length} />
        <Stat label="On trial" value={salons.filter((s) => s.plan === "TRIAL" && !subscriptionState(s).readOnly).length} />
        <Stat label="Paying" value={paying.length} />
        <Stat label="Monthly revenue" value={money(mrr * 100)} sub="from active paid plans" />
      </div>

      <Card title={`Payments to check (${pending.length})`} className="mb-6">
        {pending.length === 0 ? (
          <p className="text-sm text-stone-500">Nothing waiting.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-200 p-3 text-sm">
                <div>
                  <p className="font-medium">{p.salon.name} · {PLANS[p.plan].label} × {p.months} month{p.months === 1 ? "" : "s"} · {money(p.amount)}</p>
                  <p className="text-stone-500">bKash TrxID <span className="font-mono">{p.trxId}</span> · {formatDateTime(p.createdAt)} · by {p.submittedBy}</p>
                </div>
                <ActionForm action={reviewSubscriptionPayment} className="flex gap-2">
                  <input type="hidden" name="id" value={p.id} />
                  <Input name="note" placeholder="Note (optional)" className="w-40" />
                  <SubmitButton name="decision" value="approve" size="sm">Approve</SubmitButton>
                  <SubmitButton name="decision" value="reject" size="sm" variant="danger">Reject</SubmitButton>
                </ActionForm>
              </div>
            ))}
          </div>
        )}
      </Card>

      {salons.length === 0 ? <Empty>No salons.</Empty> : (
        <Table>
          <thead><tr><th>Salon</th><th>Plan</th><th>Status</th><th className="text-right">Users</th><th className="text-right">Customers</th><th className="text-right">Bills 30d</th><th>Joined</th><th>Adjust</th></tr></thead>
          <tbody>
            {salons.map((s) => {
              const st = subscriptionState(s);
              return (
                <tr key={s.id}>
                  <td><p className="font-medium">{s.name}</p><p className="text-xs text-stone-500">{s.phone}</p></td>
                  <td>{PLANS[s.plan].label}</td>
                  <td>
                    {st.readOnly ? <Badge color="red">Read-only</Badge> : <Badge color="green">Active</Badge>}
                    <p className="text-xs text-stone-500">
                      {s.plan === "TRIAL" && s.trialEndsAt && `trial to ${formatDate(s.trialEndsAt)}`}
                      {s.paidUntil && `paid to ${formatDate(s.paidUntil)}`}
                    </p>
                  </td>
                  <td className="text-right tabular-nums">{s._count.users}</td>
                  <td className="text-right tabular-nums">{s._count.customers}</td>
                  <td className="text-right tabular-nums">{bills.get(s.id) ?? 0}</td>
                  <td className="whitespace-nowrap">{formatDate(s.createdAt)}</td>
                  <td>
                    <ActionForm action={adjustSalonPlan} className="flex gap-1">
                      <input type="hidden" name="salonId" value={s.id} />
                      <Select name="plan" defaultValue={s.plan} className="w-auto py-1 text-xs" aria-label="Plan">
                        {Object.entries(PLANS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </Select>
                      <Input name="extendDays" type="number" defaultValue={0} className="w-16 py-1 text-xs" aria-label="Extend days" title="Extend by days" />
                      <SubmitButton size="sm" variant="secondary">Set</SubmitButton>
                    </ActionForm>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
