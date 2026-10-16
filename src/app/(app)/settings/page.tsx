import { updateSalon } from "@/app/actions/settings";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { SettingsTabs } from "@/components/settings-tabs";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireAdmin();
  const s = ctx.salon;
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs active="/settings" />
      <ActionForm action={updateSalon} className="max-w-3xl space-y-6">
        <Card title="Salon profile" >
          <p className="mb-4 text-sm text-stone-500">Printed on every invoice.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Salon name"><Input name="name" defaultValue={s.name} required /></Field>
            <Field label="Phone"><Input name="phone" defaultValue={s.phone} required /></Field>
            <Field label="Address" className="sm:col-span-2"><Input name="address" defaultValue={s.address} required /></Field>
            <Field label="Email"><Input name="email" type="email" defaultValue={s.email ?? ""} /></Field>
            <Field label="Facebook page"><Input name="facebookUrl" defaultValue={s.facebookUrl ?? ""} /></Field>
            <Field label="TikTok"><Input name="tiktokUrl" defaultValue={s.tiktokUrl ?? ""} /></Field>
          </div>
        </Card>
        <Card title="Invoices">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Invoice number prefix" hint="e.g. CLS → CLS-2026-000123">
              <Input name="invoicePrefix" defaultValue={s.invoicePrefix} required pattern="[A-Z0-9]{1,8}" />
            </Field>
            <Field label="Default receipt size">
              <Select name="receiptWidth" defaultValue={s.receiptWidth}>
                <option value="MM80">80 mm thermal</option>
                <option value="MM58">58 mm thermal</option>
                <option value="A4">A4</option>
              </Select>
            </Field>
            <Field label="Footer note" className="sm:col-span-2"><Input name="invoiceFooter" defaultValue={s.invoiceFooter ?? ""} placeholder="Thank you for visiting!" /></Field>
          </div>
        </Card>
        <Card title="Rules">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Remind after (days without a visit)">
              <Input name="reminderDays" type="number" min={14} max={730} defaultValue={s.reminderDays} required />
            </Field>
            <Field label="Max discount a sub-admin can give (%)">
              <Input name="subAdminDiscountLimitPct" type="number" min={0} max={100} defaultValue={s.subAdminDiscountLimitPct} required />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="subAdminCanViewDashboard" defaultChecked={s.subAdminCanViewDashboard} className="size-4 accent-gold" />
              Sub-admins can see the sales dashboard
            </label>
          </div>
        </Card>
        <SubmitButton>Save settings</SubmitButton>
      </ActionForm>
    </>
  );
}
