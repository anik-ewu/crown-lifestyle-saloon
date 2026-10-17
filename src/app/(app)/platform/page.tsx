import { adjustSalonPlan, createClientSalon, resetSalonOwnerPassword, reviewSubscriptionPayment } from "@/app/actions/platform";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, Field, Input, ListRow, PageHeader, Select, Stat } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { daysAgo, displayPhone, formatDate, formatDateTime, money } from "@/lib/format";
import { PLANS, subscriptionState } from "@/lib/plans";

export const metadata = { title: "Platform" };

const toInputDate = (d: Date | null) => (d ? new Date(d.getTime() + 6 * 3600 * 1000).toISOString().slice(0, 10) : "");

// Cross-salon view for the platform owner. Uses the unscoped client on purpose.
export default async function PlatformPage() {
  const ctx = await requirePlatformAdmin();
  const since = daysAgo(30);
  const [salons, pending, activity] = await Promise.all([
    prisma.salon.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { customers: true, branches: true } },
        users: { where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, phone: true, lastLoginAt: true } },
      },
    }),
    prisma.subscriptionPayment.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, include: { salon: { select: { name: true } } } }),
    prisma.invoice.groupBy({ by: ["salonId"], where: { createdAt: { gte: since }, status: "PAID" }, _count: true }),
  ]);
  const bills = new Map(activity.map((a) => [a.salonId, a._count]));
  const clients = salons.filter((s) => s.plan !== "INTERNAL");
  const paying = clients.filter((s) => (s.plan === "BASIC" || s.plan === "PRO") && !subscriptionState(s).readOnly);
  const mrr = paying.reduce((sum, s) => sum + PLANS[s.plan].monthlyTaka, 0);

  return (
    <>
      <PageHeader title="Platform" description="Your client salons, their plans and payments." />
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Client salons" value={clients.length} />
        <Stat label="On trial" value={clients.filter((s) => s.plan === "TRIAL" && !subscriptionState(s).readOnly).length} />
        <Stat label="On Basic / Pro" value={paying.length} />
        <Stat label="Monthly value" value={money(mrr * 100)} sub="list price of active plans, incl. free periods" />
      </div>

      <Card title="Add salon" className="mb-6">
        <p className="mb-4 text-sm text-stone-600">
          Creates the salon with a Main branch and starter services, plus the owner&apos;s admin login. Give the owner the one-time password; they choose their own at first sign-in and then add their staff.
        </p>
        <ActionForm action={createClientSalon} resetOnSuccess className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Salon name"><Input name="salonName" required /></Field>
          <Field label="Salon phone"><Input name="salonPhone" required inputMode="tel" /></Field>
          <Field label="Address" className="sm:col-span-2"><Input name="address" required /></Field>
          <Field label="Owner name"><Input name="ownerName" required /></Field>
          <Field label="Owner mobile (sign-in)"><Input name="ownerPhone" required inputMode="tel" placeholder="01XXXXXXXXX" /></Field>
          <Field label="Owner email (optional)"><Input name="ownerEmail" type="email" /></Field>
          <Field label="Plan">
            <Select name="plan" defaultValue="PRO">
              <option value="TRIAL">Free trial</option>
              <option value="BASIC">Basic</option>
              <option value="PRO">Pro</option>
            </Select>
          </Field>
          <Field label="Paid / free until"><Input name="until" type="date" /></Field>
          <p className="self-center text-xs text-stone-500 sm:col-span-2">
            For a free period (like Crown), pick Pro and the date charging starts. For a trial, leave the date blank for 14 days.
          </p>
          <div className="flex justify-end sm:col-span-2 lg:col-span-4"><SubmitButton>Add salon</SubmitButton></div>
        </ActionForm>
      </Card>

      <Card title={`Payments to check (${pending.length})`} className="mb-6">
        {pending.length === 0 ? (
          <p className="text-sm text-stone-500">Nothing waiting.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((p) => (
              <ListRow
                key={p.id}
                title={<>{p.salon.name} · {PLANS[p.plan].label} × {p.months} month{p.months === 1 ? "" : "s"} · {money(p.amount)}</>}
                meta={<>bKash TrxID <span className="font-mono">{p.trxId}</span> · {formatDateTime(p.createdAt)} · by {p.submittedBy}</>}
                actions={
                  <ActionForm action={reviewSubscriptionPayment}>
                    <input type="hidden" name="id" value={p.id} />
                    <Input name="note" placeholder="Note (optional)" compact className="w-40" />
                    <SubmitButton name="decision" value="approve" size="sm">Approve</SubmitButton>
                    <SubmitButton name="decision" value="reject" size="sm" variant="danger">Reject</SubmitButton>
                  </ActionForm>
                }
              />
            ))}
          </div>
        )}
      </Card>

      <h2 className="mb-2 font-semibold">Salons</h2>
      <div className="space-y-2">
        {salons.map((s) => {
          const st = subscriptionState(s);
          const owner = s.users[0];
          const isHome = s.id === ctx.salon.id;
          return (
            <ListRow
              key={s.id}
              title={
                <>
                  {s.name}
                  <Badge color="gold">{PLANS[s.plan].label}</Badge>
                  {st.readOnly ? <Badge color="red">Read-only</Badge> : <Badge color="green">Active</Badge>}
                  {isHome && <Badge>Your workspace</Badge>}
                </>
              }
              meta={
                <>
                  {owner ? `${owner.name} · ${displayPhone(owner.phone)} · last sign-in ${owner.lastLoginAt ? formatDate(owner.lastLoginAt) : "never"}` : "No owner"}
                  {" · "}{s._count.branches} branch{s._count.branches === 1 ? "" : "es"} · {s._count.customers} customers · {bills.get(s.id) ?? 0} bills in 30 days
                  {s.plan === "TRIAL" && s.trialEndsAt && ` · trial until ${formatDate(s.trialEndsAt)}`}
                  {(s.plan === "BASIC" || s.plan === "PRO") && s.paidUntil && ` · paid/free until ${formatDate(s.paidUntil)}`}
                </>
              }
              actions={
                !isHome && (
                  <>
                    <ActionForm action={adjustSalonPlan}>
                      <input type="hidden" name="salonId" value={s.id} />
                      <Select name="plan" defaultValue={s.plan} compact className="w-auto" aria-label="Plan">
                        <option value="TRIAL">Free trial</option>
                        <option value="BASIC">Basic</option>
                        <option value="PRO">Pro</option>
                      </Select>
                      <Input
                        name="until"
                        type="date"
                        compact
                        className="w-40"
                        aria-label="Paid or free until"
                        defaultValue={toInputDate(s.plan === "TRIAL" ? s.trialEndsAt : s.paidUntil)}
                      />
                      <SubmitButton size="sm" variant="secondary">Save plan</SubmitButton>
                    </ActionForm>
                    {owner && (
                      <ActionForm action={resetSalonOwnerPassword} confirm={`Give ${owner.name} a new one-time password? They'll be signed out.`}>
                        <input type="hidden" name="userId" value={owner.id} />
                        <SubmitButton size="sm" variant="ghost">Reset owner password</SubmitButton>
                      </ActionForm>
                    )}
                  </>
                )
              }
            />
          );
        })}
      </div>
    </>
  );
}
