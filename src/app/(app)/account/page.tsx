import QRCode from "qrcode";
import { disableTwoFactor, enableTwoFactor, startTwoFactor } from "@/app/actions/account";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, Field, Input, LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { displayPhone } from "@/lib/format";
import { otpauthUrl } from "@/lib/totp";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const ctx = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.user.id } });
  const setup = !user.twoFactorEnabled && user.totpSecret;
  const qr = setup ? await QRCode.toString(otpauthUrl(user.totpSecret!, displayPhone(user.phone)), { type: "svg", margin: 1, width: 180 }) : null;

  return (
    <>
      <PageHeader title="My account" description={`${user.name} · ${displayPhone(user.phone)}${user.email ? ` · ${user.email}` : ""}`} />
      <div className="grid max-w-3xl gap-6">
        <Card title="Password" actions={<LinkButton href="/change-password" variant="secondary" size="sm">Change password</LinkButton>}>
          <p className="text-sm text-stone-600">Use at least 10 characters. Changing it signs out your other devices.</p>
        </Card>
        <Card title={<span className="flex items-center gap-2">Two-step sign in {user.twoFactorEnabled ? <Badge color="green">On</Badge> : <Badge>Off</Badge>}</span>}>
          {user.twoFactorEnabled ? (
            <ActionForm action={disableTwoFactor} className="grid items-end gap-3 sm:grid-cols-3">
              <Field label="Password"><Input name="password" type="password" required autoComplete="current-password" /></Field>
              <Field label="Code from app"><Input name="code" inputMode="numeric" required autoComplete="one-time-code" /></Field>
              <SubmitButton variant="danger">Turn off</SubmitButton>
            </ActionForm>
          ) : setup ? (
            <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
              <div className="rounded-md border border-stone-200 bg-white p-2" dangerouslySetInnerHTML={{ __html: qr! }} />
              <div className="space-y-3 text-sm">
                <p>1. Install Google Authenticator or Microsoft Authenticator on your phone.</p>
                <p>2. Scan this QR code, or type the key: <code className="break-all rounded bg-stone-100 px-1 font-mono">{user.totpSecret!.match(/.{1,4}/g)!.join(" ")}</code></p>
                <p>3. Enter the 6-digit code it shows:</p>
                <ActionForm action={enableTwoFactor} className="flex gap-2">
                  <Input name="code" inputMode="numeric" required autoComplete="one-time-code" className="max-w-[10rem]" />
                  <SubmitButton>Turn on</SubmitButton>
                </ActionForm>
              </div>
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm text-stone-600">
                After your password, also ask for a code from an app on your phone. Recommended for the owner account.
              </p>
              <form action={async () => { "use server"; await startTwoFactor(); }}>
                <SubmitButton>Set up</SubmitButton>
              </form>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
