"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionState } from "@/lib/action";
import { audit } from "@/lib/audit";
import { requireUser, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateTotpSecret, verifyTotp } from "@/lib/totp";

export async function startTwoFactor(): Promise<ActionState> {
  const ctx = await requireUser({ allowReadOnly: true });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.user.id } });
  if (user.twoFactorEnabled) return fail("Two-step sign in is already on.");
  await prisma.user.update({ where: { id: user.id }, data: { totpSecret: generateTotpSecret() } });
  revalidatePath("/account");
  return ok();
}

export async function enableTwoFactor(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireUser({ allowReadOnly: true });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.user.id } });
  if (user.twoFactorEnabled) return fail("Already on.");
  if (!user.totpSecret) return fail("Start setup first.");
  if (!verifyTotp(user.totpSecret, String(fd.get("code") ?? ""))) return fail("Wrong code. Try the newest one in the app.");
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
  await audit(ctx, "auth.2fa_enabled", "User", user.id);
  revalidatePath("/account");
  return ok("Two-step sign in is on. You'll need a code from the app each time you sign in.");
}

export async function disableTwoFactor(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireUser({ allowReadOnly: true });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.user.id } });
  if (!user.twoFactorEnabled || !user.totpSecret) return fail("Two-step sign in is off.");
  if (!(await verifyPassword(String(fd.get("password") ?? ""), user.passwordHash))) return fail("Wrong password.");
  if (!verifyTotp(user.totpSecret, String(fd.get("code") ?? ""))) return fail("Wrong code.");
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, totpSecret: null } });
  await audit(ctx, "auth.2fa_disabled", "User", user.id);
  revalidatePath("/account");
  return ok("Two-step sign in is off.");
}
