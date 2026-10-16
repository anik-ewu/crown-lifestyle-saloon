import Link from "next/link";
import { SettingsTabs } from "@/components/settings-tabs";
import { Button, Empty, Input, LinkButton, PageHeader, Table } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, money } from "@/lib/format";

export const metadata = { title: "Audit log" };
const PAGE = 100;

function describe(meta: unknown): string {
  if (!meta || typeof meta !== "object") return "";
  const m = meta as Record<string, unknown>;
  const parts: string[] = [];
  if (m.itemName) parts.push(String(m.itemName));
  if (typeof m.oldPrice === "number" && typeof m.newPrice === "number") parts.push(`${money(m.oldPrice)} → ${money(m.newPrice)}`);
  if (m.number) parts.push(String(m.number));
  if (typeof m.total === "number") parts.push(money(m.total));
  if (m.name) parts.push(String(m.name));
  if (m.reason) parts.push(`“${m.reason}”`);
  if (m.pct) parts.push(`${m.pct}% discount`);
  if (m.period) parts.push(String(m.period));
  return parts.join(" · ");
}

export default async function AuditPage({ searchParams }: PageProps<"/settings/audit">) {
  const ctx = await requireAdmin();
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim().slice(0, 40);
  const page = Math.max(1, Number(sp.page) || 1);
  const where = q ? { action: { startsWith: q } } : {};
  const rows = await ctx.db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE + 1 });
  const more = rows.length > PAGE;

  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs active="/settings/audit" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <form className="flex gap-2">
          <Input name="q" defaultValue={q} placeholder="Filter: invoice, price, auth…" className="w-64" />
          <Button variant="secondary">Filter</Button>
        </form>
        <div className="flex gap-2">
          <LinkButton href="/api/export/customers" variant="secondary" size="sm">Export customers CSV</LinkButton>
          <LinkButton href="/api/export/invoices?period=year" variant="secondary" size="sm">Export this year’s invoices</LinkButton>
        </div>
      </div>
      {rows.length === 0 ? (
        <Empty>No entries.</Empty>
      ) : (
        <Table>
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th><th>IP</th></tr></thead>
          <tbody>
            {rows.slice(0, PAGE).map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                <td>{r.userName ?? "—"}</td>
                <td><code className="text-xs">{r.action}</code></td>
                <td>
                  {r.entity === "Invoice" && r.entityId ? <Link href={`/invoices/${r.entityId}`} className="hover:underline">{describe(r.meta) || "view"}</Link>
                    : r.entity === "Customer" && r.entityId ? <Link href={`/customers/${r.entityId}`} className="hover:underline">{describe(r.meta) || "view"}</Link>
                    : describe(r.meta)}
                </td>
                <td className="text-xs text-stone-500">{r.ip}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <div className="mt-4 flex gap-3 text-sm">
        {page > 1 && <Link href={`/settings/audit?${new URLSearchParams({ q, page: String(page - 1) })}`} className="hover:underline">← Newer</Link>}
        {more && <Link href={`/settings/audit?${new URLSearchParams({ q, page: String(page + 1) })}`} className="hover:underline">Older →</Link>}
      </div>
    </>
  );
}
