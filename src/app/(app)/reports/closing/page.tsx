import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { Button, Card, Input, PageHeader, Stat, Table } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { dayRange, dhakaDateString, formatDate, formatDateTime, money, PAYMENT_LABELS } from "@/lib/format";
import { salesByMethod, salesSummary } from "@/lib/reports";

export const metadata = { title: "Daily closing" };

export default async function ClosingPage({ searchParams }: PageProps<"/reports/closing">) {
  const ctx = await requireUser();
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(sp.date)) ? String(sp.date) : dhakaDateString();
  const range = dayRange(date);

  const [summary, methods, invoices, voided] = await Promise.all([
    salesSummary(ctx, range),
    salesByMethod(ctx, range),
    ctx.db.invoice.findMany({
      where: { createdAt: range },
      orderBy: { createdAt: "asc" },
      include: { customer: { select: { name: true } }, payments: true },
    }),
    ctx.db.invoice.findMany({ where: { status: "VOID", voidedAt: range }, include: { customer: { select: { name: true } } } }),
  ]);
  const cash = methods.find((m) => m.method === "CASH")?.amount ?? 0;

  return (
    <>
      <PageHeader
        title={`Daily closing · ${formatDate(range.gte)}`}
        description="Count the cash drawer against the cash total."
        actions={<PrintButton />}
      />
      <form className="no-print mb-6 flex gap-2">
        <Input type="date" name="date" defaultValue={date} className="w-auto" aria-label="Date" />
        <Button variant="secondary">Show</Button>
      </form>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Total sales" value={money(summary.revenue)} sub={`${summary.bills} bills`} />
        <Stat label="Cash in drawer" value={money(cash)} />
        <Stat label="Discounts given" value={money(summary.discounts)} />
        <Stat label="Voided today" value={voided.length} sub={voided.length ? money(voided.reduce((s, v) => s + v.total, 0)) : undefined} />
      </div>

      <Card title="By payment method" className="mb-6 max-w-md">
        {methods.length === 0 ? (
          <p className="text-sm text-stone-500">No payments.</p>
        ) : (
          <dl className="space-y-1 text-sm">
            {methods.map((m) => (
              <div key={m.method} className="flex justify-between"><dt>{PAYMENT_LABELS[m.method]}</dt><dd className="tabular-nums">{money(m.amount)}</dd></div>
            ))}
            <div className="flex justify-between border-t border-stone-200 pt-1 font-semibold"><dt>Total</dt><dd className="tabular-nums">{money(summary.revenue)}</dd></div>
          </dl>
        )}
      </Card>

      <h2 className="mb-2 font-semibold">Bills</h2>
      <Table>
        <thead><tr><th>Time</th><th>Invoice</th><th>Customer</th><th>Paid by</th><th className="text-right">Total</th></tr></thead>
        <tbody>
          {invoices.map((i) => (
            <tr key={i.id} className={i.status === "VOID" ? "text-stone-400 line-through" : ""}>
              <td>{formatDateTime(i.createdAt).split(", ").pop()}</td>
              <td><Link href={`/invoices/${i.id}`} className="hover:underline">{i.number}</Link></td>
              <td>{i.customer.name}</td>
              <td>{i.payments.filter((p) => p.amount > 0).map((p) => PAYMENT_LABELS[p.method]).join(" + ")}</td>
              <td className="text-right tabular-nums">{money(i.total)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      {voided.length > 0 && (
        <>
          <h2 className="mt-6 mb-2 font-semibold">Voided today</h2>
          <ul className="text-sm">
            {voided.map((v) => <li key={v.id}>{v.number} · {v.customer.name} · {money(v.total)} · {v.voidReason}</li>)}
          </ul>
        </>
      )}
    </>
  );
}
