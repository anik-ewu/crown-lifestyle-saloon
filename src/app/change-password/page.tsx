import { changePasswordAction, logoutAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input, Notice } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const ctx = await requireUser({ allowPasswordChange: true });
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Change password</h1>
        <p className="mb-4 text-sm text-stone-600">Signed in as {ctx.user.name}</p>
        {ctx.user.mustChangePassword && (
          <div className="mb-4">
            <Notice tone="warn">You&apos;re using a temporary password. Set your own to continue.</Notice>
          </div>
        )}
        <ActionForm action={changePasswordAction} className="space-y-4">
          <Field label="Current password">
            <Input name="current" type="password" autoComplete="current-password" required />
          </Field>
          <Field label="New password" hint="At least 10 characters.">
            <Input name="next" type="password" autoComplete="new-password" required minLength={10} />
          </Field>
          <Field label="Confirm new password">
            <Input name="confirm" type="password" autoComplete="new-password" required minLength={10} />
          </Field>
          <SubmitButton className="w-full">Save password</SubmitButton>
        </ActionForm>
        <form action={logoutAction} className="mt-4 text-center">
          <button className="text-sm text-stone-500 hover:underline">Sign out</button>
        </form>
      </div>
    </main>
  );
}
