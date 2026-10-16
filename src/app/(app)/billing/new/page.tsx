import { BillingForm } from "./billing-form";
import { LinkButton, Notice, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "New bill" };

export default async function NewBillPage({ searchParams }: PageProps<"/billing/new">) {
  const ctx = await requireUser();
  const sp = await searchParams;
  const customerId = typeof sp.customer === "string" ? sp.customer : null;

  const [services, packages, staff, customer] = await Promise.all([
    ctx.db.service.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    ctx.db.package.findMany({ where: { active: true }, orderBy: { name: "asc" }, include: { items: true } }),
    ctx.db.staffMember.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    customerId ? ctx.db.customer.findUnique({ where: { id: customerId } }) : null,
  ]);

  return (
    <>
      <PageHeader title="New bill" />
      {services.length === 0 && (
        <div className="mb-4">
          <Notice tone="warn">
            No services yet. {ctx.isAdmin ? <LinkButton href="/catalog/services" size="sm" variant="secondary">Add services</LinkButton> : "Ask an admin to add services."}
          </Notice>
        </div>
      )}
      <BillingForm
        services={services.map((s) => ({ id: s.id, name: s.name, category: s.category, price: s.price }))}
        packages={packages.map((p) => ({ id: p.id, name: p.name, price: p.price, services: p.items.map((i) => i.serviceId) }))}
        staff={staff.map((s) => ({ id: s.id, name: s.name }))}
        initialCustomer={
          customer && !customer.deletedAt
            ? { id: customer.id, name: customer.name, phone: customer.phone, notes: customer.notes, lastVisitAt: customer.lastVisitAt?.toISOString() ?? null }
            : null
        }
        discountLimit={ctx.isAdmin ? null : ctx.salon.subAdminDiscountLimitPct}
      />
    </>
  );
}
