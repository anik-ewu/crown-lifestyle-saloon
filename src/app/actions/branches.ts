"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, parseForm, type ActionState } from "@/lib/action";
import { audit } from "@/lib/audit";
import { destroyAllSessions, requireAdmin } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { checkbox, optionalText } from "@/lib/schemas";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(60),
  address: z.string().min(1, "Address is required").max(300),
  phone: optionalText(30),
  active: checkbox,
});

export async function createBranch(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  fd.set("active", "on");
  const parsed = parseForm(schema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const count = await ctx.db.branch.count({ where: { active: true } });
  const limit = PLANS[ctx.salon.plan].maxBranches;
  if (count >= limit) return fail(`Your ${PLANS[ctx.salon.plan].label} plan allows ${limit} branch${limit === 1 ? "" : "es"}. Upgrade to add more.`);
  const b = await ctx.db.branch.create({ data: { ...parsed.data, salonId: ctx.salon.id } });
  await audit(ctx, "branch.create", "Branch", b.id, { name: b.name });
  revalidatePath("/", "layout");
  return ok(`Added ${b.name}.`);
}

export async function updateBranch(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  const id = String(fd.get("id"));
  const parsed = parseForm(schema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const before = await ctx.db.branch.findUnique({ where: { id } });
  if (!before) return fail("Branch not found.");
  if (!parsed.data.active && before.active) {
    const others = await ctx.db.branch.count({ where: { active: true, NOT: { id } } });
    if (others === 0) return fail("You need at least one active branch.");
  }
  if (parsed.data.active && !before.active) {
    const count = await ctx.db.branch.count({ where: { active: true } });
    if (count >= PLANS[ctx.salon.plan].maxBranches) return fail("Your plan's branch limit is reached.");
  }
  await ctx.db.branch.update({ where: { id }, data: parsed.data });
  await audit(ctx, "branch.update", "Branch", id, { name: parsed.data.name });
  revalidatePath("/", "layout");
  return ok("Saved.");
}

/** Pin a sub-admin to one branch, or let them work at all ("" = all). */
export async function setUserBranch(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  const userId = String(fd.get("userId"));
  const branchId = String(fd.get("branchId") || "") || null;
  const u = await ctx.db.user.findUnique({ where: { id: userId } });
  if (!u || u.role !== "SUB_ADMIN") return fail("User not found.");
  if (branchId && !(await ctx.db.branch.findFirst({ where: { id: branchId } }))) return fail("Branch not found.");
  await ctx.db.user.update({ where: { id: userId }, data: { branchId } });
  await destroyAllSessions(userId);
  await audit(ctx, "user.branch", "User", userId, { name: u.name });
  revalidatePath("/settings/users");
  return ok("Branch updated. They'll need to sign in again.");
}
