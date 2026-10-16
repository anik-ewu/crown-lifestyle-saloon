import { createCustomer } from "@/app/actions/customers";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { CustomerFields } from "@/components/forms/customer-fields";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Add customer" };

export default async function NewCustomerPage({ searchParams }: PageProps<"/customers/new">) {
  await requireUser();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Add customer" />
      <Card className="max-w-2xl">
        <ActionForm action={createCustomer}>
          {sp.next === "billing" && <input type="hidden" name="next" value="billing" />}
          <CustomerFields c={{ phone: typeof sp.phone === "string" ? sp.phone : "" }} />
          <div className="mt-4"><SubmitButton>Save customer</SubmitButton></div>
        </ActionForm>
      </Card>
    </>
  );
}
