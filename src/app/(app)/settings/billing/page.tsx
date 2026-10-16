import { submitSubscriptionPayment } from "@/app/actions/subscription";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { SettingsTabs } from "@/components/settings-tabs";
import { Badge, Card, Field, Input, Notice, PageHeader, Select, Table } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate, formatDateTime, money } from "@/lib/format";
import { PLANS, priceFor, subscriptionState } from "@/lib/plans";

export const metadata = { title: "Plan & payment" };

export default async function BillingSettingsPage() {
  const ctx = await requireUser({ role: "ADMIN", allowReadOnly: true });
  const s = ctx.salon;
  const state = subscriptionState(s);
  const [payments, subAdmins, branches] = await Promise.all([
    prisma.subscriptionPayment.findMany({ where: { salonId: s.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    ctx.db.user.count({ where: { role: "SUB_ADMIN", active: true } }),
    ctx.db.branch.count({ where: { active: true } }),
  ]);
  const plan = PLANS[s.plan];
  const bkash = process.env.PLATFORM_BKASH_NUMBER;

  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs active="/settings/billing" />
      <div className="grid max-w-4xl gap-6">
        <Card title={<span className="flex items-center gap-2">Current plan <Badge color="gold">{plan.label}</Badge></span>}>
          {s.plan === "INTERNAL" ? (
            <p className="text-sm text-stone-600">This salon runs the platform, so there is no subscription to pay.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {state.notice && <Notice tone={state.tone}>{state.notice}</Notice>}
              {s.plan === "TRIAL" && s.trialEndsAt && <p>Trial ends {formatDate(s.trialEndsAt)}.</p>}
              {s.paidUntil && <p>Paid until {formatDate(s.paidUntil)}.</p>}
              <p className="text-stone-600">
                Using {subAdmins} of {plan.maxSubAdmins} sub-admin logins · {branches} of {plan.maxBranches} branch{plan.maxBranches === 1 ? "" : "es"}.
              </p>
            </div>
          )}
        </Card>

        {s.plan !== "INTERNAL" && (
          <Card title="Pay with bKash">
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              {(["BASIC", "PRO"] as const).map((p) => (
                <div key={p} className="rounded-md border border-stone-200 p-3 text-sm">
                  <p className="font-semibold">{PLANS[p].label} · ৳{PLANS[p].monthlyTaka.toLocaleString("en-IN")}/month</p>
                  <p className="text-stone-600">{PLANS[p].maxSubAdmins} sub-admins · {PLANS[p].maxBranches} branch{PLANS[p].maxBranches === 1 ? "" : "es"}</p>
                  <p className="text-xs text-stone-500">12 months: ৳{priceFor(p, 12).toLocaleString("en-IN")} (2 months free)</p>
                </div>
              ))}
            </div>
            {bkash ? (
              <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm">
                <li>In the bKash app, <b>Send Money</b> to <b className="tabular-nums">{bkash}</b> for the plan and months you want.</li>
                <li>Enter the transaction ID (TrxID) from the bKash message below.</li>
                <li>We confirm it, usually within a few hours, and your plan is extended.</li>
              </ol>
            ) : (
              <div className="mb-4"><Notice tone="warn">Payment number not configured yet (PLATFORM_BKASH_NUMBER).</Notice></div>
            )}
            <ActionForm action={submitSubscriptionPayment} resetOnSuccess className="grid items-end gap-3 sm:grid-cols-4">
              <Field label="Plan">
                <Select name="plan" defaultValue={s.plan === "PRO" ? "PRO" : "BASIC"}>
                  <option value="BASIC">Basic</option>
                  <option value="PRO">Pro</option>
                </Select>
              </Field>
              <Field label="Months">
                <Select name="months" defaultValue="1">
                  {[1, 3, 6, 12].map((m) => <option key={m} value={m}>{m}</option>)}
                </Select>
              </Field>
              <Field label="bKash TrxID"><Input name="trxId" required placeholder="e.g. 9JK3LMN0PQ" className="uppercase" /></Field>
              <SubmitButton>Submit payment</SubmitButton>
            </ActionForm>
          </Card>
        )}

        {payments.length > 0 && (
          <div>
            <h2 className="mb-2 font-semibold">Payment history</h2>
            <Table>
              <thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th>TrxID</th><th>Status</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDateTime(p.createdAt)}</td>
                    <td>{PLANS[p.plan].label} × {p.months}</td>
                    <td className="tabular-nums">{money(p.amount)}</td>
                    <td className="font-mono text-xs">{p.trxId}</td>
                    <td>
                      {p.status === "APPROVED" ? <Badge color="green">Approved</Badge> : p.status === "REJECTED" ? <Badge color="red">Rejected</Badge> : <Badge color="amber">Waiting</Badge>}
                      {p.reviewNote && <span className="ml-2 text-xs text-stone-500">{p.reviewNote}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
