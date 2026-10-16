import { adjustStock, createProduct, updateProduct } from "@/app/actions/products";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, Empty, Field, Input, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, money, toTakaInput } from "@/lib/format";

export const metadata = { title: "Products & stock" };

export default async function ProductsPage() {
  const ctx = await requireAdmin();
  const [products, movements] = await Promise.all([
    ctx.db.product.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    ctx.db.stockMovement.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { product: { select: { name: true } } } }),
  ]);

  return (
    <>
      <PageHeader title="Products & stock" description="Retail items sold at the counter (wax, shampoo, oil…). Selling one on a bill lowers its stock." />
      <Card title="Add product" className="mb-6">
        <ActionForm action={createProduct} resetOnSuccess className="grid items-end gap-3 sm:grid-cols-6">
          <Field label="Name" className="sm:col-span-2"><Input name="name" required /></Field>
          <Field label="Code / SKU"><Input name="sku" /></Field>
          <Field label="Price (৳)"><Input name="price" required inputMode="decimal" /></Field>
          <Field label="Opening stock"><Input name="stock" type="number" min={0} defaultValue={0} required /></Field>
          <Field label="Alert at"><Input name="lowStockAt" type="number" min={0} defaultValue={3} required /></Field>
          <SubmitButton className="sm:col-span-6 sm:w-fit">Add product</SubmitButton>
        </ActionForm>
      </Card>

      {products.length === 0 ? (
        <Empty>No products yet.</Empty>
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="rounded-lg border border-stone-200 bg-white p-3">
              <div className="mb-2 flex items-center gap-2 text-sm">
                <span className="font-medium">{p.name}</span>
                {p.stock <= p.lowStockAt ? <Badge color="amber">{p.stock} left</Badge> : <Badge color="green">{p.stock} in stock</Badge>}
                {!p.active && <Badge>Off</Badge>}
                <span className="text-stone-500">{money(p.price)}</span>
              </div>
              <div className="grid gap-3 2xl:grid-cols-2">
                <ActionForm action={updateProduct} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-6">
                  <input type="hidden" name="id" value={p.id} />
                  <Input name="name" defaultValue={p.name} required className="col-span-2" aria-label="Name" />
                  <Input name="sku" defaultValue={p.sku ?? ""} aria-label="SKU" placeholder="SKU" />
                  <Input name="price" defaultValue={toTakaInput(p.price)} required aria-label="Price" />
                  <Input name="lowStockAt" type="number" defaultValue={p.lowStockAt} aria-label="Alert at" />
                  <div className="flex items-center gap-2">
                    <input type="checkbox" name="active" defaultChecked={p.active} className="size-4 accent-gold" aria-label="Active" />
                    <SubmitButton variant="secondary" size="sm">Save</SubmitButton>
                  </div>
                </ActionForm>
                <ActionForm action={adjustStock} resetOnSuccess className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={p.id} />
                  <Input name="change" type="number" required placeholder="+10 or -2" className="w-28" aria-label="Stock change" />
                  <Input name="reason" required placeholder="Purchase, damaged…" className="w-44" aria-label="Reason" />
                  <SubmitButton variant="secondary" size="sm">Adjust stock</SubmitButton>
                </ActionForm>
              </div>
            </div>
          ))}
        </div>
      )}

      {movements.length > 0 && (
        <Card title="Recent stock changes" className="mt-8">
          <ul className="divide-y divide-stone-100 text-sm">
            {movements.map((m) => (
              <li key={m.id} className="flex justify-between gap-2 py-1.5">
                <span>{m.product.name} <b className={m.change < 0 ? "text-red-700" : "text-emerald-700"}>{m.change > 0 ? "+" : ""}{m.change}</b> · {m.reason}</span>
                <span className="text-stone-500">{formatDateTime(m.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
