"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, parseForm, type ActionState } from "@/lib/action";
import {
  attemptLogin,
  completeSecondFactor,
  destroyAllSessions,
  destroySession,
  createSession,
  hashPassword,
  passwordProblem,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";

const loginSchema = z.object({
  identifier: z.string().min(3, "Enter your phone or email").max(100),
  password: z.string().min(1, "Enter your password").max(128),
});

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseForm(loginSchema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const result = await attemptLogin(parsed.data.identifier, parsed.data.password);
  if (!result.ok) return fail(result.error);
  redirect(result.needsCode ? "/login/verify" : "/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

const changeSchema = z.object({
  current: z.string().min(1, "Enter your current password"),
  next: z.string(),
  confirm: z.string(),
});

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireUser({ allowPasswordChange: true });
  const parsed = parseForm(changeSchema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const { current, next, confirm } = parsed.data;
  const problem = passwordProblem(next);
  if (problem) return fail(problem);
  if (next !== confirm) return fail("New passwords don't match.");
  if (next === current) return fail("Choose a password different from the current one.");

  const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.user.id } });
  if (!(await verifyPassword(current, user.passwordHash))) return fail("Current password is wrong.");

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next), mustChangePassword: false },
  });
  // sign out every other device, then start a fresh session here
  await destroyAllSessions(user.id);
  await createSession(user.id);
  await audit(ctx, "auth.password_changed", "User", user.id);
  redirect("/?password=changed");
}

export async function verifyCodeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const code = String(fd.get("code") ?? "").slice(0, 10);
  const result = await completeSecondFactor(code);
  if (!result.ok) return fail(result.error);
  redirect("/");
}
