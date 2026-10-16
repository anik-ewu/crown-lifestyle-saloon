import { createPackage, updatePackage } from "@/app/actions/catalog";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, Empty, Field, Input, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { money, toTakaInput } from "@/lib/format";

export const metadata = { title: "Packages" };

type Svc = { id: string; name: string; price: number; category: string };

function ServicePicker({ services, selected = [] }: { services: Svc[]; selected?: string[] }) {
  return (
    <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border border-stone-200 p-2 sm:grid-cols-2">
      {services.map((s) => (
        <label key={s.id} className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-stone-50">
          <input type="checkbox" name="serviceId" value={s.id} defaultChecked={selected.includes(s.id)} className="size-4 accent-gold" />
          <span className="flex-1">{s.name}</span>
          <span className="tabular-nums text-stone-500">{money(s.price)}</span>
        </label>
      ))}
    </div>
  );
}

export default async function PackagesPage() {
  const ctx = await requireAdmin();
  const [services, packages] = await Promise.all([
    ctx.db.service.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    ctx.db.package.findMany({
      where: { OR: [{ isCustom: false }, { active: true }] },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { items: { include: { service: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader title="Packages" description="A bundle of services sold at one price. Custom packages can also be built while billing." />
      <Card title="Create package" className="mb-6">
        <ActionForm action={createPackage} resetOnSuccess className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name" className="sm:col-span-2"><Input name="name" required placeholder="e.g. Groom Package" /></Field>
            <Field label="Package price (৳)"><Input name="price" required inputMode="decimal" /></Field>
          </div>
          <ServicePicker services={services} />
          <SubmitButton>Create package</SubmitButton>
        </ActionForm>
      </Card>

      {packages.length === 0 ? (
        <Empty>No packages yet.</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {packages.map((p) => {
            const listValue = p.items.reduce((s, i) => s + i.service.price * i.qty, 0);
            return (
              <Card
                key={p.id}
                title={<span className="flex items-center gap-2">{p.name} {!p.active && <Badge>Off</Badge>} {p.isCustom && <Badge color="blue">Custom</Badge>}</span>}
                actions={<span className="text-sm text-stone-500">List value {money(listValue)} · Saves {money(Math.max(0, listValue - p.price))}</span>}
              >
                <ActionForm action={updatePackage} className="space-y-3">
                  <input type="hidden" name="id" value={p.id} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Name" className="sm:col-span-2"><Input name="name" defaultValue={p.name} required /></Field>
                    <Field label="Price (৳)"><Input name="price" defaultValue={toTakaInput(p.price)} required inputMode="decimal" /></Field>
                  </div>
                  <ServicePicker
                    services={[...services, ...p.items.map((i) => i.service).filter((s) => !s.active)]}
                    selected={p.items.map((i) => i.serviceId)}
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="active" defaultChecked={p.active} className="size-4 accent-gold" /> Active
                    </label>
                    <SubmitButton variant="secondary" size="sm">Save</SubmitButton>
                  </div>
                </ActionForm>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
