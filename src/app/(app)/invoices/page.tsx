import Link from "next/link";
import { InvoiceStatusBadge } from "@/components/badges";
import { Button, Empty, Input, Notice, PageHeader, Select, Table } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { dayRange, dhakaDateString, displayPhone, formatDateTime, money } from "@/lib/format";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  const ctx = await requireUser();
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim().slice(0, 40);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(sp.date)) ? String(sp.date) : q ? "" : dhakaDateString();
  const filter = String(sp.filter ?? "");

  const where = {
    ...(date ? { createdAt: dayRange(date) } : {}),
    ...(q ? { number: { contains: q.toUpperCase() } } : {}),
    ...(filter === "void" ? { status: "VOID" as const } : {}),
    ...(filter === "requests" ? { status: "PAID" as const, voidRequestedAt: { not: null } } : {}),
  };
  const [invoices, requests] = await Promise.all([
    ctx.db.invoice.findMany({
      where: filter === "requests" ? { status: "PAID", voidRequestedAt: { not: null } } : where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { customer: true },
    }),
    ctx.isAdmin ? ctx.db.invoice.count({ where: { status: "PAID", voidRequestedAt: { not: null } } }) : 0,
  ]);
  const paidTotal = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.total, 0);

  return (
    <>
      <PageHeader
        title="Invoices"
        description={`${invoices.length} invoice${invoices.length === 1 ? "" : "s"} · ${money(paidTotal)} paid`}
      />
      {requests > 0 && filter !== "requests" && (
        <div className="mb-4">
          <Notice tone="warn">
            {requests} void request{requests === 1 ? "" : "s"} waiting. <Link href="/invoices?filter=requests" className="font-medium underline">Review</Link>
          </Notice>
        </div>
      )}
      <form className="mb-4 flex flex-wrap gap-2">
        <Input type="date" name="date" defaultValue={date} className="w-auto" aria-label="Date" />
        <Input name="q" defaultValue={q} placeholder="Invoice number" className="max-w-[12rem]" />
        <Select name="filter" defaultValue={filter} className="w-auto">
          <option value="">All</option>
          <option value="void">Void only</option>
          {ctx.isAdmin && <option value="requests">Void requests</option>}
        </Select>
        <Button variant="secondary">Show</Button>
      </form>
      {invoices.length === 0 ? (
        <Empty>No invoices for this filter.</Empty>
      ) : (
        <Table>
          <thead>
            <tr><th>Number</th><th>Time</th><th>Customer</th><th className="text-right">Total</th><th>Status</th></tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id}>
                <td><Link href={`/invoices/${i.id}`} className="font-medium hover:underline">{i.number}</Link></td>
                <td className="whitespace-nowrap">{formatDateTime(i.createdAt)}</td>
                <td>{i.customer.name} <span className="text-stone-500">{i.customer.deletedAt ? "" : displayPhone(i.customer.phone)}</span></td>
                <td className="text-right tabular-nums">{money(i.total)}</td>
                <td><InvoiceStatusBadge status={i.status} voidRequested={!!i.voidRequestedAt} /></td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
