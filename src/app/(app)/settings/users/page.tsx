import { createSubAdmin, resetSubAdminPassword, setSubAdminActive } from "@/app/actions/settings";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { SettingsTabs } from "@/components/settings-tabs";
import { Badge, Card, Empty, Field, Input, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { displayPhone, formatDateTime } from "@/lib/format";

export const metadata = { title: "Sub-admins" };

export default async function UsersPage() {
  const ctx = await requireAdmin();
  const users = await ctx.db.user.findMany({ orderBy: [{ role: "asc" }, { active: "desc" }, { name: "asc" }] });
  const subs = users.filter((u) => u.role === "SUB_ADMIN");
  const admins = users.filter((u) => u.role === "ADMIN");

  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs active="/settings/users" />

      <Card title="Add sub-admin" className="mb-6 max-w-3xl">
        <p className="mb-4 text-sm text-stone-600">
          They sign in with their phone number and a one-time temporary password, then must choose their own.
        </p>
        <ActionForm action={createSubAdmin} resetOnSuccess className="grid items-end gap-3 sm:grid-cols-4">
          <Field label="Name"><Input name="name" required /></Field>
          <Field label="Mobile number"><Input name="phone" required inputMode="tel" placeholder="01XXXXXXXXX" /></Field>
          <Field label="Email (optional)"><Input name="email" type="email" /></Field>
          <SubmitButton>Create</SubmitButton>
        </ActionForm>
      </Card>

      <h2 className="mb-2 font-semibold">Sub-admins</h2>
      {subs.length === 0 ? (
        <Empty>No sub-admins yet.</Empty>
      ) : (
        <div className="space-y-2">
          {subs.map((u) => (
            <div key={u.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-stone-200 bg-white p-3">
              <div>
                <p className="font-medium">{u.name} {!u.active && <Badge>Deactivated</Badge>} {u.mustChangePassword && u.active && <Badge color="amber">Temp password</Badge>}</p>
                <p className="text-sm text-stone-500">
                  {displayPhone(u.phone)}{u.email && ` · ${u.email}`} · Last sign-in {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "never"}
                </p>
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <ActionForm action={resetSubAdminPassword} confirm={`Reset ${u.name}'s password? They'll be signed out.`}>
                  <input type="hidden" name="id" value={u.id} />
                  <SubmitButton variant="secondary" size="sm">Reset password</SubmitButton>
                </ActionForm>
                <ActionForm action={setSubAdminActive} confirm={u.active ? `Deactivate ${u.name}? They'll be signed out immediately.` : undefined}>
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="active" value={String(!u.active)} />
                  <SubmitButton variant={u.active ? "danger" : "secondary"} size="sm">{u.active ? "Deactivate" : "Reactivate"}</SubmitButton>
                </ActionForm>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mt-8 mb-2 font-semibold">Admins</h2>
      <ul className="text-sm text-stone-700">
        {admins.map((u) => <li key={u.id}>{u.name} · {displayPhone(u.phone)}{u.email && ` · ${u.email}`}</li>)}
      </ul>
    </>
  );
}
