"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, parseForm, type ActionState } from "@/lib/action";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PLANS, priceFor } from "@/lib/plans";

const paySchema = z.object({
  plan: z.enum(["BASIC", "PRO"]),
  months: z.coerce.number().refine((m) => [1, 3, 6, 12].includes(m), "Pick 1, 3, 6 or 12 months"),
  trxId: z
    .string()
    .transform((v) => v.toUpperCase().replace(/\s/g, ""))
    .refine((v) => /^[A-Z0-9]{8,12}$/.test(v), "Enter the bKash transaction ID (8–12 letters/digits)"),
});

export async function submitSubscriptionPayment(_: ActionState, fd: FormData): Promise<ActionState> {
  // Salon admins must reach this even when the app is read-only.
  const ctx = await requireUser({ role: "ADMIN", allowReadOnly: true });
  const parsed = parseForm(paySchema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const { plan, months, trxId } = parsed.data;
  const pending = await prisma.subscriptionPayment.count({ where: { salonId: ctx.salon.id, status: "PENDING" } });
  if (pending >= 3) return fail("You already have payments waiting for review.");
  try {
    await prisma.subscriptionPayment.create({
      data: { salonId: ctx.salon.id, plan, months, amount: priceFor(plan, months) * 100, method: "bkash", trxId, submittedBy: ctx.user.name },
    });
  } catch {
    return fail("This transaction ID was already submitted.");
  }
  await audit(ctx, "subscription.payment_submitted", "Salon", ctx.salon.id, { name: `${PLANS[plan].label} × ${months}`, reason: trxId });
  revalidatePath("/settings/billing");
  return ok("Thanks! We'll confirm the payment shortly, usually within a few hours.");
}
