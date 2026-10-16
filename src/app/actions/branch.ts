"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { BRANCH_COOKIE } from "@/lib/branch";

export async function setCurrentBranch(fd: FormData) {
  const ctx = await requireUser({ allowReadOnly: true });
  if (ctx.user.branchId) return;
  const id = String(fd.get("branchId") ?? "");
  const b = await ctx.db.branch.findFirst({ where: { id, active: true } });
  if (!b) return;
  (await cookies()).set(BRANCH_COOKIE, b.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}
