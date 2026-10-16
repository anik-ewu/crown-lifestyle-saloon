import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteCustomer, updateCustomer } from "@/app/actions/customers";
import { restoreCustomer } from "@/app/actions/reminders";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { CustomerStatusBadge, InvoiceStatusBadge } from "@/components/badges";
import { CustomerFields } from "@/components/forms/customer-fields";
import { Card, Empty, LinkButton, PageHeader, Stat, Table } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { displayPhone, formatDate, formatDateTime, money, PAYMENT_LABELS } from "@/lib/format";

export default async function CustomerPage({ params }: PageProps<"/customers/[id]">) {
  const ctx = await requireUser();
  const { id } = await params;
  const c = await ctx.db.customer.findUnique({ where: { id } });
  if (!c || c.deletedAt) notFound();

  const [invoices, totals, calls] = await Promise.all([
    ctx.db.invoice.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { items: { include: { staffMember: true } }, payments: true },
    }),
    ctx.db.invoice.aggregate({ where: { customerId: id, status: "PAID" }, _sum: { total: true }, _count: true }),
    ctx.db.reminderLog.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-3">{c.name} <CustomerStatusBadge status={c.status} /></span>}
        description={
          <>
            <a href={`tel:${c.phone}`} className="hover:underline">{displayPhone(c.phone)}</a>
            {c.address && <> · {c.address}</>}
          </>
        }
        actions={<LinkButton href={`/billing/new?customer=${c.id}`} variant="gold">New bill</LinkButton>}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Lifetime spend" value={money(totals._sum.total ?? 0)} />
        <Stat label="Visits" value={totals._count} />
        <Stat label="Last visit" value={c.lastVisitAt ? formatDate(c.lastVisitAt) : "—"} />
      </div>

      {c.notes && (
        <div className="mb-6 rounded-lg border border-gold/40 bg-gold-light/40 p-3 text-sm">
          <span className="font-medium">Notes: </span>{c.notes}
        </div>
      )}

      <h2 className="mb-2 font-semibold">Visit history</h2>
      {invoices.length === 0 ? (
        <Empty>No visits yet.</Empty>
      ) : (
        <Table>
          <thead>
            <tr><th>Date</th><th>Services</th><th>Served by</th><th className="text-right">Amount</th><th>Paid by</th><th>Invoice</th></tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className={inv.status === "VOID" ? "text-stone-400 line-through" : ""}>
                <td className="whitespace-nowrap">{formatDateTime(inv.createdAt)}</td>
                <td>{inv.items.map((i) => (i.qty > 1 ? `${i.nameSnapshot} ×${i.qty}` : i.nameSnapshot)).join(", ")}</td>
                <td>{[...new Set(inv.items.map((i) => i.staffMember?.name).filter(Boolean))].join(", ") || "—"}</td>
                <td className="text-right tabular-nums">{money(inv.total)}</td>
                <td>{inv.payments.map((p) => PAYMENT_LABELS[p.method]).join(" + ")}</td>
                <td className="whitespace-nowrap">
                  <Link href={`/invoices/${inv.id}`} className="hover:underline">{inv.number}</Link>{" "}
                  {inv.status === "VOID" && <InvoiceStatusBadge status={inv.status} />}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {(calls.length > 0 || c.status !== "ACTIVE") && (
        <Card title="Reminder calls" className="mt-8" actions={c.status !== "ACTIVE" && (
          <ActionForm action={restoreCustomer} showMessage={false}>
            <input type="hidden" name="customerId" value={c.id} />
            <SubmitButton variant="secondary" size="sm">Make active</SubmitButton>
          </ActionForm>
        )}>
          {c.status === "SNOOZED" && c.snoozedUntil && <p className="mb-2 text-sm">Snoozed until {formatDate(c.snoozedUntil)}.</p>}
          {c.status === "ARCHIVED" && <p className="mb-2 text-sm">Archived ({c.archivedReason?.replace("_", " ") ?? "no reason"}).</p>}
          <ul className="divide-y divide-stone-100 text-sm">
            {calls.map((r) => (
              <li key={r.id} className="py-1.5">
                {formatDateTime(r.createdAt)} · {r.calledByName} · {r.outcome.replace("_", " ").toLowerCase()}
                {r.note && <span className="text-stone-600"> · “{r.note}”</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card title="Edit details" className="lg:col-span-2">
          <ActionForm action={updateCustomer}>
            <input type="hidden" name="id" value={c.id} />
            <CustomerFields c={c} />
            <div className="mt-4"><SubmitButton>Save changes</SubmitButton></div>
          </ActionForm>
        </Card>
        {ctx.isAdmin && (
          <Card title="Delete customer">
            <p className="mb-3 text-sm text-stone-600">
              Wipes name, phone, address and notes. Past bills stay in sales totals as “Deleted customer”. This can’t be undone.
            </p>
            <ActionForm action={deleteCustomer} confirm={`Delete ${c.name}? This can't be undone.`}>
              <input type="hidden" name="id" value={c.id} />
              <SubmitButton variant="danger">Delete customer</SubmitButton>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
