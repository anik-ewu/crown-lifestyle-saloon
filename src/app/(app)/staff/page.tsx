import { createStaff, updateStaff } from "@/app/actions/staff";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, Empty, Field, Input, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { displayPhone } from "@/lib/format";

export const metadata = { title: "Salon members" };

export default async function StaffPage() {
  const ctx = await requireAdmin();
  const staff = await ctx.db.staffMember.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });

  return (
    <>
      <PageHeader
        title="Salon members"
        description="Stylists and barbers who serve customers. Removing someone only deactivates them, so past bills keep their name."
      />
      <Card title="Add member" className="mb-6">
        <ActionForm action={createStaff} resetOnSuccess className="grid items-end gap-3 sm:grid-cols-5">
          <Field label="Name"><Input name="name" required /></Field>
          <Field label="Phone"><Input name="phone" inputMode="tel" placeholder="01XXXXXXXXX" /></Field>
          <Field label="Title"><Input name="title" placeholder="Senior stylist" /></Field>
          <Field label="Commission %"><Input name="commissionPct" type="number" min={0} max={100} defaultValue={0} /></Field>
          <SubmitButton>Add</SubmitButton>
        </ActionForm>
      </Card>
      {staff.length === 0 ? (
        <Empty>No salon members yet.</Empty>
      ) : (
        <div className="space-y-2">
          {staff.map((m) => (
            <ActionForm key={m.id} action={updateStaff} className="rounded-lg border border-stone-200 bg-white p-3">
              <input type="hidden" name="id" value={m.id} />
              <div className="grid grid-cols-2 items-center gap-3 md:grid-cols-12">
                <Input name="name" defaultValue={m.name} required className="col-span-2 md:col-span-4" aria-label="Name" />
                <Input name="phone" defaultValue={m.phone ? displayPhone(m.phone) : ""} className="md:col-span-3" aria-label="Phone" />
                <Input name="title" defaultValue={m.title ?? ""} className="md:col-span-1" aria-label="Title" />
                <Input name="commissionPct" type="number" min={0} max={100} defaultValue={m.commissionPct} className="md:col-span-1" aria-label="Commission %" title="Commission %" />
                <label className="flex items-center gap-2 text-sm md:col-span-1">
                  <input type="checkbox" name="active" defaultChecked={m.active} className="size-4 accent-gold" />
                  {m.active ? "Active" : <Badge>Inactive</Badge>}
                </label>
                <div className="md:col-span-2"><SubmitButton variant="secondary" size="sm">Save</SubmitButton></div>
              </div>
            </ActionForm>
          ))}
        </div>
      )}
    </>
  );
}
