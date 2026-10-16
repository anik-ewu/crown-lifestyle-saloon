import Link from "next/link";
import { archiveCustomer, logCall, restoreCustomer } from "@/app/actions/reminders";
import { deleteCustomer } from "@/app/actions/customers";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Empty, Input, PageHeader, Select } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { daysBetween, displayPhone, formatDate, money, whatsappLink } from "@/lib/format";
import { dueWhere } from "@/lib/reminders";

export const metadata = { title: "Reminders" };

const TABS = [
  { key: "due", label: "Due for a call" },
  { key: "snoozed", label: "Snoozed" },
  { key: "archived", label: "Archived" },
] as const;

export default async function RemindersPage({ searchParams }: PageProps<"/reminders">) {
  const ctx = await requireUser();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "due";
  const now = new Date();

  const where =
    tab === "due"
      ? dueWhere(ctx, now)
      : tab === "snoozed"
        ? { deletedAt: null, status: "SNOOZED" as const, snoozedUntil: { gt: now } }
        : { deletedAt: null, status: "ARCHIVED" as const };

  const [customers, dueCount] = await Promise.all([
    ctx.db.customer.findMany({
      where,
      orderBy: tab === "snoozed" ? { snoozedUntil: "asc" } : { lastVisitAt: { sort: "asc", nulls: "first" } },
      take: 200,
      include: {
        invoices: {
          where: { status: "PAID" },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { items: { select: { nameSnapshot: true } } },
        },
        reminders: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    ctx.db.customer.count({ where: dueWhere(ctx, now) }),
  ]);
  const spend = await ctx.db.invoice.groupBy({
    by: ["customerId"],
    where: { status: "PAID", customerId: { in: customers.map((c) => c.id) } },
    _sum: { total: true },
  });
  const spendBy = new Map(spend.map((s) => [s.customerId, s._sum.total ?? 0]));

  return (
    <>
      <PageHeader
        title="Reminders"
        description={`Customers with no visit for ${ctx.salon.reminderDays}+ days. Call them, then snooze or archive.`}
      />
      <div className="mb-6 flex gap-1 border-b border-stone-200">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/reminders?tab=${t.key}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.key ? "border-gold font-medium text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"}`}
          >
            {t.label}
            {t.key === "due" && dueCount > 0 && <span className="ml-1.5 rounded-full bg-gold px-1.5 text-xs text-ink">{dueCount}</span>}
          </Link>
        ))}
      </div>

      {customers.length === 0 ? (
        <Empty>{tab === "due" ? "Nobody to call right now." : "Nothing here."}</Empty>
      ) : (
        <div className="space-y-3">
          {customers.map((c) => {
            const last = c.invoices[0];
            const lastCall = c.reminders[0];
            return (
              <div key={c.id} className="rounded-lg border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/customers/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                    <a href={`tel:${c.phone}`} className="ml-3 font-medium tabular-nums text-gold-dark hover:underline">{displayPhone(c.phone)}</a>
                    <a
                      href={whatsappLink(c.phone, `Hi ${c.name.split(" ")[0]}, we miss you at ${ctx.salon.name}! It's been a while since your last visit. Call ${ctx.salon.phone} to book your next appointment.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-3 text-sm text-emerald-700 hover:underline"
                    >
                      WhatsApp
                    </a>
                    <p className="mt-1 text-sm text-stone-600">
                      {c.lastVisitAt ? <>Last visit {formatDate(c.lastVisitAt)} · <b>{daysBetween(c.lastVisitAt, now)} days ago</b></> : "Never visited"}
                      {last && <> · {last.items.map((i) => i.nameSnapshot).join(", ")}</>}
                      {" · "}Lifetime {money(spendBy.get(c.id) ?? 0)}
                    </p>
                    {lastCall && (
                      <p className="mt-1 text-xs text-stone-500">
                        Last call {formatDate(lastCall.createdAt)} by {lastCall.calledByName}: {OUTCOMES[lastCall.outcome]}{lastCall.note && ` · “${lastCall.note}”`}
                      </p>
                    )}
                    {tab === "snoozed" && c.snoozedUntil && <p className="mt-1 text-xs"><Badge color="amber">Back on {formatDate(c.snoozedUntil)}</Badge></p>}
                    {tab === "archived" && <p className="mt-1 text-xs"><Badge>{ARCHIVE_REASONS[c.archivedReason ?? "other"] ?? c.archivedReason}</Badge></p>}
                  </div>
                  {tab === "archived" && (
                    <ActionForm action={restoreCustomer}>
                      <input type="hidden" name="customerId" value={c.id} />
                      <SubmitButton variant="secondary" size="sm">Restore</SubmitButton>
                    </ActionForm>
                  )}
                </div>

                {tab !== "archived" && (
                  <div className="mt-3 grid gap-3 border-t border-stone-100 pt-3 lg:grid-cols-[1fr_auto]">
                    <ActionForm action={logCall} resetOnSuccess className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="customerId" value={c.id} />
                      <Select name="outcome" className="w-auto" aria-label="Call outcome">
                        {Object.entries(OUTCOMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </Select>
                      <Input name="note" placeholder="Note (optional)" className="max-w-xs" maxLength={500} />
                      <label className="flex items-center gap-1.5 text-sm">
                        <input type="checkbox" name="snooze" defaultChecked className="size-4 accent-gold" /> Snooze {ctx.salon.reminderDays} days
                      </label>
                      <SubmitButton size="sm">Log call</SubmitButton>
                    </ActionForm>
                    <div className="flex flex-wrap items-start gap-2">
                      <ActionForm action={archiveCustomer} className="flex gap-2">
                        <input type="hidden" name="customerId" value={c.id} />
                        <Select name="reason" className="w-auto py-1 text-sm" aria-label="Archive reason">
                          {Object.entries(ARCHIVE_REASONS).filter(([k]) => k !== "deleted").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </Select>
                        <SubmitButton variant="secondary" size="sm">Archive</SubmitButton>
                      </ActionForm>
                      {ctx.isAdmin && (
                        <ActionForm action={deleteCustomer} confirm={`Delete ${c.name}? Personal data is wiped; this can't be undone.`}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="back" value="reminders" />
                          <SubmitButton variant="danger" size="sm">Delete</SubmitButton>
                        </ActionForm>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

const OUTCOMES: Record<string, string> = {
  REACHED: "Reached",
  WILL_COME: "Will come",
  NO_ANSWER: "No answer",
  OTHER: "Other",
};

const ARCHIVE_REASONS: Record<string, string> = {
  moved: "Moved away",
  not_interested: "Not interested",
  other: "Other",
  deleted: "Deleted",
};
