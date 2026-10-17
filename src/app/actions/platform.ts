"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, parseForm, type ActionState } from "@/lib/action";
import { destroyAllSessions, generateTempPassword, hashPassword, requirePlatformAdmin, type Ctx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dhakaMidnight } from "@/lib/format";
import { createSalonWithOwner } from "@/lib/onboarding";
import { TRIAL_DAYS } from "@/lib/plans";
import { phoneField } from "@/lib/schemas";

// Everything here works across salons, so it uses the unscoped client and is
// guarded by requirePlatformAdmin().

const DAY = 24 * 60 * 60 * 1000;

function platformAudit(ctx: Ctx, salonId: string, action: string, meta?: Record<string, unknown>) {
  return prisma.auditLog.create({
    data: { salonId, userId: ctx.user.id, userName: `${ctx.user.name} (platform)`, action, meta: meta as object | undefined },
  });
}

/** "YYYY-MM-DD" → end of that day in Dhaka, so "free until 31 Dec" includes 31 Dec. */
const untilDate = z
  .string()
  .optional()
  .transform((v, c) => {
    if (!v) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      c.addIssue({ code: "custom", message: "Invalid date" });
      return z.NEVER;
    }
    return new Date(dhakaMidnight(v).getTime() + DAY - 1000);
  });

const salonSchema = z.object({
  salonName: z.string().min(2, "Salon name is required").max(100),
  address: z.string().min(3, "Address is required").max(300),
  salonPhone: z.string().min(5, "Salon phone is required").max(30),
  ownerName: z.string().min(1, "Owner name is required").max(100),
  ownerPhone: phoneField,
  ownerEmail: z
    .string()
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => v === null || z.email().safeParse(v).success, "Invalid email"),
  plan: z.enum(["TRIAL", "BASIC", "PRO"]),
  until: untilDate,
});

export async function createClientSalon(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requirePlatformAdmin();
  const parsed = parseForm(salonSchema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const d = parsed.data;
  if (await prisma.user.findUnique({ where: { phone: d.ownerPhone } })) return fail("That owner mobile number already has an account.");
  if (d.ownerEmail && (await prisma.user.findUnique({ where: { email: d.ownerEmail } }))) return fail("That email already has an account.");
  if (d.plan !== "TRIAL" && !d.until) return fail("Set the paid / free-until date for a Basic or Pro salon.");

  const temp = generateTempPassword();
  const passwordHash = await hashPassword(temp);
  const { salon } = await prisma.$transaction((tx) =>
    createSalonWithOwner(tx, {
      salonName: d.salonName,
      address: d.address,
      salonPhone: d.salonPhone,
      ownerName: d.ownerName,
      ownerPhone: d.ownerPhone,
      ownerEmail: d.ownerEmail,
      passwordHash,
      mustChangePassword: true,
      plan: d.plan,
      trialEndsAt: d.plan === "TRIAL" ? (d.until ?? new Date(Date.now() + TRIAL_DAYS * DAY)) : null,
      paidUntil: d.plan === "TRIAL" ? null : d.until,
    }),
  );
  await platformAudit(ctx, salon.id, "salon.onboarded", { name: salon.name, period: d.plan });
  revalidatePath("/platform");
  return ok(`${salon.name} is ready. ${d.ownerName} signs in with ${d.ownerPhone.replace("+88", "")} and this one-time password:`, {
    secret: temp,
  });
}

export async function resetSalonOwnerPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requirePlatformAdmin();
  const userId = String(fd.get("userId"));
  const owner = await prisma.user.findUnique({ where: { id: userId } });
  if (!owner || owner.role !== "ADMIN") return fail("Owner not found.");
  if (owner.id === ctx.user.id) return fail("Use My account to change your own password.");
  const temp = generateTempPassword();
  await prisma.user.update({
    where: { id: owner.id },
    data: { passwordHash: await hashPassword(temp), mustChangePassword: true, failedLogins: 0, lockedUntil: null, active: true },
  });
  await destroyAllSessions(owner.id);
  await platformAudit(ctx, owner.salonId, "user.password_reset", { name: owner.name });
  return ok(`New one-time password for ${owner.name}:`, { secret: temp });
}

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
  await platformAudit(ctx, p.salonId, approve ? "subscription.approved" : "subscription.rejected", { reason: p.trxId });
  revalidatePath("/platform");
  return ok(approve ? `Approved. ${p.salon.name} is paid for ${p.months} more month(s).` : "Rejected.");
}

const adjustSchema = z.object({
  salonId: z.string().min(1),
  plan: z.enum(["TRIAL", "BASIC", "PRO", "INTERNAL"]),
  until: untilDate,
});

/** Set a salon's plan and its paid / free / trial end date (e.g. Crown free until 31 Dec). */
export async function adjustSalonPlan(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requirePlatformAdmin();
  const parsed = parseForm(adjustSchema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const { salonId, plan, until } = parsed.data;
  const salon = await prisma.salon.findUnique({ where: { id: salonId } });
  if (!salon) return fail("Salon not found.");
  if (salon.id === ctx.salon.id && plan !== "INTERNAL") return fail("Your own workspace must stay on the Owner plan.");
  if ((plan === "BASIC" || plan === "PRO") && !until) return fail("Pick the paid / free-until date.");
  await prisma.salon.update({
    where: { id: salonId },
    data:
      plan === "TRIAL"
        ? { plan, trialEndsAt: until ?? new Date(Date.now() + TRIAL_DAYS * DAY) }
        : plan === "INTERNAL"
          ? { plan }
          : { plan, paidUntil: until },
  });
  await platformAudit(ctx, salonId, "subscription.adjusted", { name: plan, period: until?.toISOString().slice(0, 10) });
  revalidatePath("/platform");
  return ok(`${salon.name} updated.`);
}
