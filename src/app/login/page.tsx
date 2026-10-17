import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input } from "@/components/ui";
import { Wordmark } from "@/components/wordmark";
import { getContext } from "@/lib/auth";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getContext()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <Wordmark subtitle="Sign in" />
        </div>
        <div className="rounded-lg bg-white p-6 shadow-xl">
          <ActionForm action={loginAction} className="space-y-4">
            <Field label="Phone or email">
              <Input name="identifier" autoComplete="username" required autoFocus placeholder="01XXXXXXXXX" />
            </Field>
            <Field label="Password">
              <Input name="password" type="password" autoComplete="current-password" required />
            </Field>
            <SubmitButton className="w-full">Sign in</SubmitButton>
          </ActionForm>
        </div>
        {process.env.ALLOW_SIGNUP === "true" && (
          <p className="mt-4 text-center text-sm text-stone-400">
            New salon? <Link href="/signup" className="text-gold-light hover:underline">Start a free trial</Link>
          </p>
        )}
      </div>
    </main>
  );
}
