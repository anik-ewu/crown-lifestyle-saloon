import { redirect } from "next/navigation";
import { logoutAction, verifyCodeAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input } from "@/components/ui";
import { getPendingSession } from "@/lib/auth";
import { APP_NAME } from "@/lib/brand";

export const metadata = { title: "Enter code" };

export default async function VerifyPage() {
  const pending = await getPendingSession();
  if (!pending) redirect("/login");
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h1 className="text-lg font-semibold">Two-step sign in</h1>
        <p className="mb-4 text-sm text-stone-600">Open your authenticator app and enter the 6-digit code for {APP_NAME}.</p>
        <ActionForm action={verifyCodeAction} className="space-y-4">
          <Field label="Code">
            <Input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" required autoFocus className="text-center text-xl tracking-[0.4em]" />
          </Field>
          <SubmitButton className="w-full">Verify</SubmitButton>
        </ActionForm>
        <form action={logoutAction} className="mt-4 text-center">
          <button className="text-sm text-stone-500 hover:underline">Cancel</button>
        </form>
      </div>
    </main>
  );
}
