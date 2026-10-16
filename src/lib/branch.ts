import "server-only";
import type { Ctx } from "@/lib/auth";

/** The branch a bill is recorded against. */
export async function currentBranchId(ctx: Ctx): Promise<string> {
  if (ctx.user.branchId) return ctx.user.branchId;
  const b = await ctx.db.branch.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" } });
  if (!b) throw new Error("No active branch configured");
  return b.id;
}
