"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, parseForm, type ActionState } from "@/lib/action";
import { audit } from "@/lib/audit";
import { requireAdmin, requireUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";
import { customerSchema } from "@/lib/schemas";

export async function createCustomer(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireUser();
  const parsed = parseForm(customerSchema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const existing = await ctx.db.customer.findFirst({ where: { phone: parsed.data.phone } });
  if (existing) return fail("A customer with this phone number already exists.");
  const customer = await ctx.db.customer.create({ data: { ...parsed.data, salonId: ctx.salon.id } });
  await audit(ctx, "customer.create", "Customer", customer.id);
  const next = fd.get("next");
  redirect(next === "billing" ? `/billing/new?customer=${customer.id}` : `/customers/${customer.id}`);
}

export async function updateCustomer(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireUser();
  const id = String(fd.get("id"));
  const parsed = parseForm(customerSchema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const clash = await ctx.db.customer.findFirst({ where: { phone: parsed.data.phone, NOT: { id } } });
  if (clash) return fail("Another customer already uses this phone number.");
  const before = await ctx.db.customer.findUnique({ where: { id } });
  if (!before || before.deletedAt) return fail("Customer not found.");
  await ctx.db.customer.update({ where: { id }, data: parsed.data });
  await audit(ctx, "customer.update", "Customer", id, before.phone !== parsed.data.phone ? { phoneChanged: true } : undefined);
  revalidatePath(`/customers/${id}`);
  return ok("Saved.");
}

/** Soft delete: personal data is wiped, visits stay for sales totals. */
export async function deleteCustomer(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  const id = String(fd.get("id"));
  const c = await ctx.db.customer.findUnique({ where: { id } });
  if (!c || c.deletedAt) return fail("Customer not found.");
  await ctx.db.customer.update({
    where: { id },
    data: {
      name: "Deleted customer",
      phone: `deleted:${id}`,
      address: null,
      gender: null,
      dob: null,
      notes: null,
      status: "ARCHIVED",
      archivedReason: "deleted",
      deletedAt: new Date(),
    },
  });
  await audit(ctx, "customer.delete", "Customer", id);
  if (fd.get("back") === "reminders") {
    revalidatePath("/reminders");
    return ok("Customer deleted.");
  }
  redirect("/customers?deleted=1");
}

export type CustomerHit = { id: string; name: string; phone: string; notes: string | null; lastVisitAt: string | null };

export async function searchCustomers(q: string): Promise<CustomerHit[]> {
  const ctx = await requireUser();
  const term = q.trim().slice(0, 50);
  if (term.length < 2) return [];
  const digits = term.replace(/\D/g, "").replace(/^(880|0)/, "");
  const rows = await ctx.db.customer.findMany({
    where: {
      deletedAt: null,
      OR: [
        ...(digits.length >= 2 ? [{ phone: { contains: digits } }] : []),
        { name: { contains: term, mode: "insensitive" as const } },
      ],
    },
    orderBy: { lastVisitAt: { sort: "desc", nulls: "last" } },
    take: 8,
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    notes: c.notes,
    lastVisitAt: c.lastVisitAt?.toISOString() ?? null,
  }));
}

const quickSchema = z.object({ phone: z.string(), name: z.string().trim().min(1).max(100) });

export async function quickCreateCustomer(
  input: z.infer<typeof quickSchema>,
): Promise<{ customer?: CustomerHit; error?: string }> {
  const ctx = await requireUser();
  const parsed = quickSchema.safeParse(input);
  if (!parsed.success) return { error: "Enter a name and phone number." };
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return { error: "Enter a valid Bangladeshi mobile number (01XXXXXXXXX)." };
  const existing = await ctx.db.customer.findFirst({ where: { phone, deletedAt: null } });
  const c =
    existing ??
    (await ctx.db.customer.create({ data: { phone, name: parsed.data.name, salonId: ctx.salon.id } }));
  if (!existing) await audit(ctx, "customer.create", "Customer", c.id);
  return {
    customer: { id: c.id, name: c.name, phone: c.phone, notes: c.notes, lastVisitAt: c.lastVisitAt?.toISOString() ?? null },
  };
}
