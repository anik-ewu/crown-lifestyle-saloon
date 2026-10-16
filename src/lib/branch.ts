import "server-only";
import { cookies } from "next/headers";
import type { Ctx } from "@/lib/auth";

export const BRANCH_COOKIE = "cls_branch";

export async function activeBranches(ctx: Ctx) {
  return ctx.db.branch.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });
}

/**
 * The branch new bills, appointments and expenses go to: the user's own
 * branch, else the branch picked in the sidebar, else the first one.
 */
export async function currentBranchId(ctx: Ctx): Promise<string> {
  if (ctx.user.branchId) return ctx.user.branchId;
  const picked = (await cookies()).get(BRANCH_COOKIE)?.value;
  const branches = await activeBranches(ctx);
  const b = branches.find((x) => x.id === picked) ?? branches[0];
  if (!b) throw new Error("No active branch configured");
  return b.id;
}
