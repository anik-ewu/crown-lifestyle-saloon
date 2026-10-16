import { createService, updateService } from "@/app/actions/catalog";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, Empty, Field, Input, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, money, toTakaInput } from "@/lib/format";

export const metadata = { title: "Services" };

export default async function ServicesPage() {
  const ctx = await requireAdmin();
  const [services, history] = await Promise.all([
    ctx.db.service.findMany({ orderBy: [{ active: "desc" }, { category: "asc" }, { name: "asc" }] }),
    ctx.db.priceHistory.findMany({ orderBy: { changedAt: "desc" }, take: 15 }),
  ]);
  const categories = [...new Set(services.map((s) => s.category))];

  return (
    <>
      <PageHeader title="Services" description="Prices are copied onto each bill, so changing a price never changes old invoices." />

      <Card title="Add service" className="mb-6">
        <ActionForm action={createService} resetOnSuccess className="grid items-end gap-3 sm:grid-cols-5">
          <Field label="Name" className="sm:col-span-2"><Input name="name" required maxLength={100} /></Field>
          <Field label="Category">
            <Input name="category" required list="categories" placeholder="Hair, Beard, Skin…" />
          </Field>
          <Field label="Price (৳)"><Input name="price" required inputMode="decimal" /></Field>
          <SubmitButton>Add</SubmitButton>
          <datalist id="categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </ActionForm>
      </Card>

      {services.length === 0 ? (
        <Empty>No services yet.</Empty>
      ) : (
        <div className="space-y-2">
          <div className="hidden grid-cols-12 gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-stone-500 md:grid">
            <span className="col-span-4">Name</span><span className="col-span-2">Category</span><span className="col-span-2">Price ৳</span><span className="col-span-1">Min</span><span className="col-span-1">Active</span>
          </div>
          {services.map((s) => (
            <ActionForm key={s.id} action={updateService} className="rounded-lg border border-stone-200 bg-white p-3">
              <input type="hidden" name="id" value={s.id} />
              <div className="grid grid-cols-2 items-center gap-3 md:grid-cols-12">
                <Input name="name" defaultValue={s.name} required className="col-span-2 md:col-span-4" aria-label="Name" />
                <Input name="category" defaultValue={s.category} required list="categories" className="md:col-span-2" aria-label="Category" />
                <Input name="price" defaultValue={toTakaInput(s.price)} required inputMode="decimal" className="md:col-span-2" aria-label="Price" />
                <Input name="durationMin" defaultValue={s.durationMin ?? ""} inputMode="numeric" className="md:col-span-1" aria-label="Duration minutes" />
                <label className="flex items-center gap-2 text-sm md:col-span-1">
                  <input type="checkbox" name="active" defaultChecked={s.active} className="size-4 accent-gold" />
                  {!s.active && <Badge>Off</Badge>}
                </label>
                <div className="md:col-span-2"><SubmitButton variant="secondary" size="sm">Save</SubmitButton></div>
              </div>
            </ActionForm>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <Card title="Recent price changes" className="mt-8">
          <ul className="divide-y divide-stone-100 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{h.itemName}: <span className="text-stone-500 line-through">{money(h.oldPrice)}</span> → <span className="font-medium">{money(h.newPrice)}</span></span>
                <span className="text-stone-500">{formatDateTime(h.changedAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
