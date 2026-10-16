import { LinkButton, Notice, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { subscriptionState } from "@/lib/plans";

export const metadata = { title: "Read-only" };

export default async function ReadOnlyPage() {
  const ctx = await requireUser();
  const state = subscriptionState(ctx.salon);
  return (
    <>
      <PageHeader title="Read-only mode" />
      <div className="max-w-xl space-y-4">
        <Notice tone={state.readOnly ? "error" : "success"}>
          {state.readOnly ? state.notice : "Your subscription is active again. Everything works normally."}
        </Notice>
        <p className="text-sm text-stone-600">
          You can still look up customers, invoices and reports, and export your data. Saving new bills and changes is paused.
        </p>
        {ctx.isAdmin ? (
          <LinkButton href="/settings/billing" variant="gold">Pay for a plan</LinkButton>
        ) : (
          <p className="text-sm text-stone-600">Ask the salon owner to renew the plan.</p>
        )}
      </div>
    </>
  );
}
