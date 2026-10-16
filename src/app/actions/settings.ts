"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, parseForm, type ActionState } from "@/lib/action";
import { audit } from "@/lib/audit";
import { destroyAllSessions, generateTempPassword, hashPassword, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PLANS } from "@/lib/plans";
import { checkbox, optionalText, phoneField } from "@/lib/schemas";

const salonSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(5).max(30),
  email: optionalText(100),
  address: z.string().min(1).max(300),
  facebookUrl: optionalText(200),
  tiktokUrl: optionalText(200),
  invoicePrefix: z.string().regex(/^[A-Z0-9]{1,8}$/, "Use 1-8 capital letters or digits"),
  invoiceFooter: optionalText(300),
  receiptWidth: z.enum(["MM58", "MM80", "A4"]),
  reminderDays: z.coerce.number().int().min(14).max(730),
  subAdminDiscountLimitPct: z.coerce.number().int().min(0).max(100),
  subAdminCanViewDashboard: checkbox,
  loyaltyPointsPer100: z.coerce.number().int().min(0).max(100),
});

export async function updateSalon(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  const parsed = parseForm(salonSchema, fd);
  if (!parsed.ok) return fail(parsed.error);
  // Salon is not a tenant model, so scope by id explicitly.
  await prisma.salon.update({ where: { id: ctx.salon.id }, data: parsed.data });
  await audit(ctx, "settings.update", "Salon", ctx.salon.id);
  revalidatePath("/", "layout");
  return ok("Settings saved.");
}

const subAdminSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  phone: phoneField,
  email: z
    .string()
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => v === null || z.email().safeParse(v).success, "Invalid email"),
});

export async function createSubAdmin(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  const parsed = parseForm(subAdminSchema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const { phone, email, name } = parsed.data;
  if (await prisma.user.findUnique({ where: { phone } })) return fail("This phone number already has an account.");
  if (email && (await prisma.user.findUnique({ where: { email } }))) return fail("This email already has an account.");

  const activeSubs = await ctx.db.user.count({ where: { role: "SUB_ADMIN", active: true } });
  const limit = PLANS[ctx.salon.plan].maxSubAdmins;
  if (activeSubs >= limit) return fail(`Your ${PLANS[ctx.salon.plan].label} plan allows ${limit} sub-admins. Upgrade to add more.`);

  const temp = generateTempPassword();
  const branchId = String(fd.get("branchId") || "") || null;
  if (branchId && !(await ctx.db.branch.findFirst({ where: { id: branchId } }))) return fail("Branch not found.");
  const user = await ctx.db.user.create({
    data: {
      salonId: ctx.salon.id,
      branchId,
      name,
      phone,
      email,
      role: "SUB_ADMIN",
      passwordHash: await hashPassword(temp),
      mustChangePassword: true,
    },
  });
  await audit(ctx, "user.create", "User", user.id, { name, role: "SUB_ADMIN" });
  revalidatePath("/settings/users");
  return ok(`${name} can now sign in with their phone number and this temporary password:`, { secret: temp });
}

async function subAdmin(ctxSalonDb: Awaited<ReturnType<typeof requireAdmin>>, id: string) {
  const u = await ctxSalonDb.db.user.findUnique({ where: { id } });
  return u && u.role === "SUB_ADMIN" ? u : null;
}

export async function resetSubAdminPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  const u = await subAdmin(ctx, String(fd.get("id")));
  if (!u) return fail("User not found.");
  const temp = generateTempPassword();
  await ctx.db.user.update({
    where: { id: u.id },
    data: { passwordHash: await hashPassword(temp), mustChangePassword: true, failedLogins: 0, lockedUntil: null },
  });
  await destroyAllSessions(u.id);
  await audit(ctx, "user.password_reset", "User", u.id, { name: u.name });
  return ok(`New temporary password for ${u.name}:`, { secret: temp });
}

export async function setSubAdminActive(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  const u = await subAdmin(ctx, String(fd.get("id")));
  if (!u) return fail("User not found.");
  const active = fd.get("active") === "true";
  if (active) {
    const activeSubs = await ctx.db.user.count({ where: { role: "SUB_ADMIN", active: true } });
    if (activeSubs >= PLANS[ctx.salon.plan].maxSubAdmins) return fail("Your plan's sub-admin limit is reached.");
  }
  await ctx.db.user.update({ where: { id: u.id }, data: { active } });
  if (!active) await destroyAllSessions(u.id);
  await audit(ctx, active ? "user.activate" : "user.deactivate", "User", u.id, { name: u.name });
  revalidatePath("/settings/users");
  return ok(active ? `${u.name} reactivated.` : `${u.name} deactivated and signed out.`);
}
