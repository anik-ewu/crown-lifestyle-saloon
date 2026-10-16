import { Badge } from "@/components/ui";
import type { CustomerStatus, InvoiceStatus } from "@/generated/prisma/client";

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  if (status === "ACTIVE") return <Badge color="green">Active</Badge>;
  if (status === "SNOOZED") return <Badge color="amber">Snoozed</Badge>;
  return <Badge>Archived</Badge>;
}

export function InvoiceStatusBadge({ status, voidRequested }: { status: InvoiceStatus; voidRequested?: boolean }) {
  if (status === "VOID") return <Badge color="red">Void</Badge>;
  if (voidRequested) return <Badge color="amber">Void requested</Badge>;
  return <Badge color="green">Paid</Badge>;
}
