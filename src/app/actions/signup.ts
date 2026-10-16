"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, parseForm, type ActionState } from "@/lib/action";
import { clientIp, createSession, hashPassword, passwordProblem } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TRIAL_DAYS } from "@/lib/plans";
import { phoneField } from "@/lib/schemas";
import { STARTER_SERVICES } from "@/lib/starter";

export async function signupEnabled() {
  return process.env.ALLOW_SIGNUP === "true";
}

const schema = z.object({
  salonName: z.string().min(2, "Salon name is required").max(100),
  address: z.string().min(5, "Address is required").max(300),
  ownerName: z.string().min(1, "Your name is required").max(100),
  phone: phoneField,
  email: z.email("Enter a valid email").transform((v) => v.toLowerCase()),
  password: z.string(),
});

export async function signupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await signupEnabled())) return fail("Sign-up is closed.");
  // honeypot field, hidden from people; bots tend to fill it
  if (fd.get("website")) return fail("Sign-up failed.");
  fd.delete("website");
  const parsed = parseForm(schema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const d = parsed.data;
  const problem = passwordProblem(d.password);
  if (problem) return fail(problem);

  const ip = await clientIp();
  const recent = await prisma.loginAttempt.count({
    where: { identifier: "signup", ip, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= 3) return fail("Too many sign-ups from this network. Try again later.");
  await prisma.loginAttempt.create({ data: { identifier: "signup", ip, success: true } });

  if (await prisma.user.findUnique({ where: { phone: d.phone } })) return fail("This phone number already has an account. Sign in instead.");
  if (await prisma.user.findUnique({ where: { email: d.email } })) return fail("This email already has an account.");

  const prefix = d.salonName.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "INV";
  const user = await prisma.$transaction(async (tx) => {
    const salon = await tx.salon.create({
      data: {
        name: d.salonName,
        phone: d.phone,
        email: d.email,
        address: d.address,
        invoicePrefix: prefix,
        plan: "TRIAL",
        trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
        branches: { create: { name: "Main", address: d.address, phone: d.phone } },
      },
    });
    await tx.service.createMany({
      data: STARTER_SERVICES.map(([category, name, taka]) => ({ salonId: salon.id, category, name, price: taka * 100 })),
    });
    const user = await tx.user.create({
      data: { salonId: salon.id, name: d.ownerName, phone: d.phone, email: d.email, role: "ADMIN", passwordHash: await hashPassword(d.password) },
    });
    await tx.auditLog.create({ data: { salonId: salon.id, userId: user.id, userName: user.name, action: "salon.signup", ip } });
    return user;
  });
  await createSession(user.id);
  redirect("/settings?welcome=1");
}
