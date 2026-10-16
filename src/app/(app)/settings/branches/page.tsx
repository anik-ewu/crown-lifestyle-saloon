import { createBranch, updateBranch } from "@/app/actions/branches";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { SettingsTabs } from "@/components/settings-tabs";
import { Badge, Card, Field, Input, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { PLANS } from "@/lib/plans";

export const metadata = { title: "Branches" };

export default async function BranchesPage() {
  const ctx = await requireAdmin();
  const branches = await ctx.db.branch.findMany({ orderBy: { createdAt: "asc" } });
  const limit = PLANS[ctx.salon.plan].maxBranches;

  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs active="/settings/branches" />
      <p className="mb-4 text-sm text-stone-600">
        Customers, services and prices are shared by all branches. Bills, appointments and expenses are recorded per branch.
        {limit < 100 && ` Your plan allows ${limit} active branch${limit === 1 ? "" : "es"}.`}
      </p>
      <div className="max-w-3xl space-y-4">
        {branches.map((b) => (
          <Card key={b.id} title={<span className="flex items-center gap-2">{b.name} {!b.active && <Badge>Closed</Badge>}</span>}>
            <ActionForm action={updateBranch} className="grid items-end gap-3 sm:grid-cols-6">
              <input type="hidden" name="id" value={b.id} />
              <Field label="Name" className="sm:col-span-2"><Input name="name" defaultValue={b.name} required /></Field>
              <Field label="Phone" className="sm:col-span-2"><Input name="phone" defaultValue={b.phone ?? ""} /></Field>
              <label className="flex items-center gap-2 pb-2 text-sm sm:col-span-2">
                <input type="checkbox" name="active" defaultChecked={b.active} className="size-4 accent-gold" /> Open
              </label>
              <Field label="Address" className="sm:col-span-5"><Input name="address" defaultValue={b.address} required /></Field>
              <SubmitButton variant="secondary" size="sm">Save</SubmitButton>
            </ActionForm>
          </Card>
        ))}
        <Card title="Add branch">
          <ActionForm action={createBranch} resetOnSuccess className="grid items-end gap-3 sm:grid-cols-6">
            <Field label="Name" className="sm:col-span-2"><Input name="name" required placeholder="e.g. Dhanmondi" /></Field>
            <Field label="Phone" className="sm:col-span-2"><Input name="phone" /></Field>
            <Field label="Address" className="sm:col-span-6"><Input name="address" required /></Field>
            <SubmitButton>Add branch</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
