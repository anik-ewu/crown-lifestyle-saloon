"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, parseForm, type ActionState } from "@/lib/action";
import { audit } from "@/lib/audit";
import { requirePlatformAdmin, requireUser } from "@/lib/auth";
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

const DAY = 24 * 60 * 60 * 1000;

export async function reviewSubscriptionPayment(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requirePlatformAdmin();
  const id = String(fd.get("id"));
  const approve = fd.get("decision") === "approve";
  const note = String(fd.get("note") ?? "").slice(0, 200) || null;
  const p = await prisma.subscriptionPayment.findUnique({ where: { id }, include: { salon: true } });
  if (!p || p.status !== "PENDING") return fail("Payment not found or already reviewed.");

  await prisma.$transaction(async (tx) => {
    await tx.subscriptionPayment.update({
      where: { id },
      data: { status: approve ? "APPROVED" : "REJECTED", reviewedBy: ctx.user.name, reviewNote: note, reviewedAt: new Date() },
    });
    if (approve) {
      const start = Math.max(Date.now(), p.salon.paidUntil?.getTime() ?? 0);
      const paidUntil = new Date(start);
      paidUntil.setUTCMonth(paidUntil.getUTCMonth() + p.months);
      await tx.salon.update({ where: { id: p.salonId }, data: { plan: p.plan, paidUntil } });
    }
  });
  await prisma.auditLog.create({
    data: { salonId: p.salonId, userId: ctx.user.id, userName: `${ctx.user.name} (platform)`, action: approve ? "subscription.approved" : "subscription.rejected", meta: { reason: p.trxId } },
  });
  revalidatePath("/platform");
  return ok(approve ? `Approved. ${p.salon.name} is paid for ${p.months} more month(s).` : "Rejected.");
}

const adjustSchema = z.object({
  salonId: z.string().min(1),
  plan: z.enum(["TRIAL", "BASIC", "PRO", "INTERNAL"]),
  extendDays: z.coerce.number().int().min(-3650).max(3650),
});

/** Manual override for support cases (extend a trial, comp a month). */
export async function adjustSalonPlan(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requirePlatformAdmin();
  const parsed = parseForm(adjustSchema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const { salonId, plan, extendDays } = parsed.data;
  const salon = await prisma.salon.findUnique({ where: { id: salonId } });
  if (!salon) return fail("Salon not found.");
  const data: { plan: typeof plan; trialEndsAt?: Date; paidUntil?: Date } = { plan };
  if (extendDays) {
    if (plan === "TRIAL") data.trialEndsAt = new Date(Math.max(Date.now(), salon.trialEndsAt?.getTime() ?? 0) + extendDays * DAY);
    else data.paidUntil = new Date(Math.max(Date.now(), salon.paidUntil?.getTime() ?? 0) + extendDays * DAY);
  }
  await prisma.salon.update({ where: { id: salonId }, data });
  await prisma.auditLog.create({
    data: { salonId, userId: ctx.user.id, userName: `${ctx.user.name} (platform)`, action: "subscription.adjusted", meta: { name: plan, period: `${extendDays} days` } },
  });
  revalidatePath("/platform");
  return ok(`${salon.name} updated.`);
}
