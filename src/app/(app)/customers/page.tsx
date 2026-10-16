import Link from "next/link";
import { CustomerStatusBadge } from "@/components/badges";
import { Empty, Input, LinkButton, Notice, PageHeader, Select, Table, Button } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { displayPhone, formatDate } from "@/lib/format";
import type { CustomerStatus } from "@/generated/prisma/client";

export const metadata = { title: "Customers" };
const PAGE = 50;

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const ctx = await requireUser();
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim().slice(0, 50);
  const status = ["ACTIVE", "SNOOZED", "ARCHIVED"].includes(String(sp.status)) ? (String(sp.status) as CustomerStatus) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const digits = q.replace(/\D/g, "").replace(/^(880|0)/, "");

  const where = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            ...(digits.length >= 2 ? [{ phone: { contains: digits } }] : []),
            { name: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [rows, count] = await Promise.all([
    ctx.db.customer.findMany({
      where,
      orderBy: { lastVisitAt: { sort: "desc", nulls: "last" } },
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { _count: { select: { invoices: { where: { status: "PAID" } } } } },
    }),
    ctx.db.customer.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(count / PAGE));
  const qs = (p: number) => `/customers?${new URLSearchParams({ ...(q && { q }), ...(status && { status }), page: String(p) })}`;

  return (
    <>
      <PageHeader
        title="Customers"
        description={`${count} customer${count === 1 ? "" : "s"}`}
        actions={<LinkButton href="/customers/new">Add customer</LinkButton>}
      />
      {sp.deleted && <div className="mb-4"><Notice tone="success">Customer deleted.</Notice></div>}
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={q} placeholder="Search phone or name" className="max-w-xs" />
        <Select name="status" defaultValue={status ?? ""} className="w-auto">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SNOOZED">Snoozed</option>
          <option value="ARCHIVED">Archived</option>
        </Select>
        <Button variant="secondary">Search</Button>
      </form>
      {rows.length === 0 ? (
        <Empty>{q ? "No customers match." : "No customers yet."}</Empty>
      ) : (
        <Table>
          <thead>
            <tr><th>Name</th><th>Phone</th><th>Visits</th><th>Last visit</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/customers/${c.id}`} className="font-medium text-stone-900 hover:underline">{c.name}</Link></td>
                <td className="tabular-nums">{displayPhone(c.phone)}</td>
                <td className="tabular-nums">{c._count.invoices}</td>
                <td>{c.lastVisitAt ? formatDate(c.lastVisitAt) : "—"}</td>
                <td><CustomerStatusBadge status={c.status} /></td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {pages > 1 && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          {page > 1 && <Link href={qs(page - 1)} className="hover:underline">← Previous</Link>}
          <span className="text-stone-500">Page {page} of {pages}</span>
          {page < pages && <Link href={qs(page + 1)} className="hover:underline">Next →</Link>}
        </div>
      )}
    </>
  );
}
