import Image from "next/image";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input } from "@/components/ui";
import { getContext } from "@/lib/auth";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getContext()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/logo.jpg" alt="" width={112} height={112} className="rounded-full" priority />
          <h1 className="mt-4 text-xl font-semibold text-gold-light">Crown LifeStyle Saloon</h1>
          <p className="text-sm text-stone-400">Staff sign in</p>
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
      </div>
    </main>
  );
}
