import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { signupAction, signupEnabled } from "@/app/actions/signup";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input } from "@/components/ui";
import { getContext } from "@/lib/auth";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";

export const metadata = { title: "Start your free trial" };

export default async function SignupPage() {
  if (!(await signupEnabled())) notFound();
  if (await getContext()) redirect("/");
  return (
    <main className="min-h-screen bg-ink px-4 py-10">
      <div className="mx-auto grid max-w-4xl gap-8 lg:grid-cols-2">
        <div className="text-stone-200">
          <Image src="/logo.jpg" alt="" width={72} height={72} className="rounded-full" />
          <h1 className="mt-4 text-2xl font-semibold text-gold-light">Salon manager for Bangladesh</h1>
          <p className="mt-2 text-stone-400">Billing, customer history, reminders for lapsed customers, sales reports. Works in any browser.</p>
          <ul className="mt-6 space-y-2 text-sm">
            <li>✓ {TRIAL_DAYS}-day free trial, no payment needed</li>
            <li>✓ {PLANS.BASIC.label}: ৳{PLANS.BASIC.monthlyTaka.toLocaleString("en-IN")}/month · {PLANS.BASIC.maxSubAdmins} staff logins · 1 branch</li>
            <li>✓ {PLANS.PRO.label}: ৳{PLANS.PRO.monthlyTaka.toLocaleString("en-IN")}/month · {PLANS.PRO.maxSubAdmins} staff logins · {PLANS.PRO.maxBranches} branches</li>
            <li>✓ Pay with bKash</li>
          </ul>
        </div>
        <div className="rounded-lg bg-white p-6 shadow-xl">
          <h2 className="mb-4 font-semibold">Create your salon</h2>
          <ActionForm action={signupAction} className="space-y-3">
            <Field label="Salon name"><Input name="salonName" required /></Field>
            <Field label="Salon address"><Input name="address" required /></Field>
            <Field label="Your name"><Input name="ownerName" required autoComplete="name" /></Field>
            <Field label="Mobile number" hint="You'll sign in with this."><Input name="phone" required inputMode="tel" placeholder="01XXXXXXXXX" autoComplete="tel" /></Field>
            <Field label="Email"><Input name="email" type="email" required autoComplete="email" /></Field>
            <Field label="Password" hint="At least 10 characters."><Input name="password" type="password" required minLength={10} autoComplete="new-password" /></Field>
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
            <SubmitButton className="w-full">Start free trial</SubmitButton>
          </ActionForm>
          <p className="mt-4 text-center text-sm text-stone-500">Already have an account? <Link href="/login" className="text-gold-dark hover:underline">Sign in</Link></p>
        </div>
      </div>
    </main>
  );
}
