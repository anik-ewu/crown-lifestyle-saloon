"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, parseForm, type ActionState } from "@/lib/action";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { checkbox, optionalText } from "@/lib/schemas";

const callSchema = z.object({
  customerId: z.string().min(1),
  outcome: z.enum(["REACHED", "NO_ANSWER", "WILL_COME", "OTHER"]),
  note: optionalText(500),
  snooze: checkbox,
});

export async function logCall(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireUser();
  const parsed = parseForm(callSchema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const { customerId, outcome, note, snooze } = parsed.data;
  const c = await ctx.db.customer.findUnique({ where: { id: customerId } });
  if (!c || c.deletedAt) return fail("Customer not found.");
  const snoozedUntil = snooze ? new Date(Date.now() + ctx.salon.reminderDays * 24 * 60 * 60 * 1000) : null;
  await ctx.db.reminderLog.create({
    data: { salonId: ctx.salon.id, customerId, calledById: ctx.user.id, calledByName: ctx.user.name, outcome, note, snoozedUntil },
  });
  if (snoozedUntil) await ctx.db.customer.update({ where: { id: customerId }, data: { status: "SNOOZED", snoozedUntil } });
  revalidatePath("/reminders");
  revalidatePath(`/customers/${customerId}`);
  return ok(snoozedUntil ? `${c.name} hidden for ${ctx.salon.reminderDays} days.` : "Call logged.");
}

const archiveSchema = z.object({
  customerId: z.string().min(1),
  reason: z.enum(["moved", "not_interested", "other"]),
});

export async function archiveCustomer(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireUser();
  const parsed = parseForm(archiveSchema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const c = await ctx.db.customer.findUnique({ where: { id: parsed.data.customerId } });
  if (!c || c.deletedAt) return fail("Customer not found.");
  await ctx.db.customer.update({
    where: { id: c.id },
    data: { status: "ARCHIVED", archivedReason: parsed.data.reason, snoozedUntil: null },
  });
  await audit(ctx, "customer.archive", "Customer", c.id, { reason: parsed.data.reason });
  revalidatePath("/reminders");
  revalidatePath(`/customers/${c.id}`);
  return ok(`${c.name} archived.`);
}

export async function restoreCustomer(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireUser();
  const id = String(fd.get("customerId"));
  const c = await ctx.db.customer.findUnique({ where: { id } });
  if (!c || c.deletedAt) return fail("Customer not found.");
  await ctx.db.customer.update({ where: { id }, data: { status: "ACTIVE", archivedReason: null, snoozedUntil: null } });
  await audit(ctx, "customer.restore", "Customer", id);
  revalidatePath("/reminders");
  revalidatePath(`/customers/${id}`);
  return ok(`${c.name} is active again.`);
}
