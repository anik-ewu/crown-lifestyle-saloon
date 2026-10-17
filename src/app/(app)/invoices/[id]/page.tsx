import Link from "next/link";
import { notFound } from "next/navigation";
import { dismissVoidRequest, requestVoid, voidInvoice } from "@/app/actions/billing";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { InvoiceStatusBadge } from "@/components/badges";
import { Card, Input, LinkButton, Notice, PageHeader, buttonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { displayPhone, formatDateTime, money, PAYMENT_LABELS, whatsappLink } from "@/lib/format";

export default async function InvoicePage({ params, searchParams }: PageProps<"/invoices/[id]">) {
  const ctx = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const inv = await ctx.db.invoice.findUnique({
    where: { id },
    include: { customer: true, items: { include: { staffMember: true } }, payments: true },
  });
  if (!inv) notFound();
  const users = await ctx.db.user.findMany({
    where: { id: { in: [inv.createdById, inv.voidedById, inv.voidRequestedById].filter((x): x is string => !!x) } },
    select: { id: true, name: true },
  });
  const who = (uid: string | null) => users.find((u) => u.id === uid)?.name ?? "—";
  const printHref = (w: string) => `/print/invoices/${inv.id}?w=${w}&auto=1`;

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-3">{inv.number} <InvoiceStatusBadge status={inv.status} voidRequested={!!inv.voidRequestedAt} /></span>}
        description={`${formatDateTime(inv.createdAt)} · billed by ${who(inv.createdById)}`}
        actions={
          inv.status === "PAID" && (
            <>
              <a href={printHref(ctx.salon.receiptWidth)} target="_blank" className={buttonClass("gold")}>Print receipt</a>
              <a href={printHref(ctx.salon.receiptWidth === "A4" ? "MM80" : "A4")} target="_blank" className={buttonClass("secondary")}>
                {ctx.salon.receiptWidth === "A4" ? "Print 80 mm" : "Print A4"}
              </a>
              {!inv.customer.deletedAt && (
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass("secondary")}
                  href={whatsappLink(
                    inv.customer.phone,
                    [
                      `${ctx.salon.name} · Invoice ${inv.number}`,
                      ...inv.items.map((i) => `${i.nameSnapshot}${i.qty > 1 ? ` x${i.qty}` : ""}: ${money(i.lineTotal)}`),
                      ...(inv.discountAmount ? [`Discount: -${money(inv.discountAmount)}`] : []),
                      ...(inv.pointsRedeemed ? [`Points: -${money(inv.pointsRedeemed * 100)}`] : []),
                      `Total paid: ${money(inv.total)}`,
                      "Thank you for visiting!",
                    ].join("\n"),
                  )}
                >
                  Send on WhatsApp
                </a>
              )}
            </>
          )
        }
      />
      {sp.new && <div className="mb-4"><Notice tone="success">Bill saved. <LinkButton href="/billing/new" size="sm" variant="secondary" className="ml-2">Next bill</LinkButton></Notice></div>}
      {inv.status === "VOID" && (
        <div className="mb-4"><Notice tone="error">Voided by {who(inv.voidedById)} on {formatDateTime(inv.voidedAt!)}: {inv.voidReason}</Notice></div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Bill" className="lg:col-span-2">
          <p className="mb-3 text-sm">
            <Link href={`/customers/${inv.customerId}`} className="font-medium hover:underline">{inv.customer.name}</Link>
            {!inv.customer.deletedAt && <span className="text-stone-500"> · {displayPhone(inv.customer.phone)}</span>}
          </p>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-stone-500">
              <tr><th className="py-1">Item</th><th>Served by</th><th className="text-right">Qty</th><th className="text-right">Amount</th></tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {inv.items.map((i) => (
                <tr key={i.id}>
                  <td className="py-2">{i.nameSnapshot}</td>
                  <td>{i.staffMember?.name ?? "—"}</td>
                  <td className="text-right">{i.qty}</td>
                  <td className="text-right tabular-nums">{money(i.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{money(inv.subtotal)}</dd></div>
            {inv.discountAmount > 0 && (
              <div className="flex justify-between">
                <dt>Discount{inv.discountType === "PERCENT" && ` (${inv.discountValue}%)`}{inv.discountNote && ` · ${inv.discountNote}`}</dt>
                <dd className="tabular-nums">−{money(inv.discountAmount)}</dd>
              </div>
            )}
            {inv.pointsRedeemed > 0 && (
              <div className="flex justify-between"><dt>Loyalty points ({inv.pointsRedeemed})</dt><dd className="tabular-nums">−{money(inv.pointsRedeemed * 100)}</dd></div>
            )}
            <div className="flex justify-between border-t border-stone-200 pt-1 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{money(inv.total)}</dd></div>
            {inv.payments.filter((p) => p.amount > 0).map((p) => (
              <div key={p.id} className="flex justify-between text-stone-600"><dt>{PAYMENT_LABELS[p.method]}</dt><dd className="tabular-nums">{money(p.amount)}</dd></div>
            ))}
            {inv.pointsEarned > 0 && <p className="pt-1 text-xs text-stone-500">Earned {inv.pointsEarned} loyalty points</p>}
          </dl>
        </Card>

        {inv.status === "PAID" && (
          <Card title={ctx.isAdmin ? "Void invoice" : "Request void"}>
            {inv.voidRequestedAt && (
              <div className="mb-3">
                <Notice tone="warn">
                  {who(inv.voidRequestedById)} asked to void this on {formatDateTime(inv.voidRequestedAt)}: “{inv.voidRequestReason}”
                </Notice>
              </div>
            )}
            {ctx.isAdmin ? (
              <>
                <p className="mb-3 text-sm text-stone-600">A voided invoice stays on record but is left out of sales.</p>
                <ActionForm action={voidInvoice} confirm="Void this invoice?" className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={inv.id} />
                  <Input name="reason" required minLength={3} placeholder="Reason" defaultValue={inv.voidRequestReason ?? ""} className="min-w-0 flex-1" />
                  <SubmitButton variant="danger">Void invoice</SubmitButton>
                </ActionForm>
                {inv.voidRequestedAt && (
                  <ActionForm action={dismissVoidRequest} className="mt-2">
                    <input type="hidden" name="id" value={inv.id} />
                    <SubmitButton variant="ghost" size="sm">Dismiss request</SubmitButton>
                  </ActionForm>
                )}
              </>
            ) : inv.voidRequestedAt ? (
              <p className="text-sm text-stone-600">Waiting for an admin.</p>
            ) : (
              <ActionForm action={requestVoid} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={inv.id} />
                <Input name="reason" required minLength={3} placeholder="What went wrong?" className="min-w-0 flex-1" />
                <SubmitButton variant="secondary">Ask admin to void</SubmitButton>
              </ActionForm>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
