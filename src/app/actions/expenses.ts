"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, parseForm, type ActionState } from "@/lib/action";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { currentBranchId } from "@/lib/branch";
import { optionalText, takaField } from "@/lib/schemas";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  category: z.string().min(1, "Category is required").max(50),
  amount: takaField.refine((v) => v > 0, "Amount must be more than 0"),
  note: optionalText(200),
});

export async function createExpense(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  const parsed = parseForm(schema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const e = await ctx.db.expense.create({
    data: {
      ...parsed.data,
      date: new Date(parsed.data.date + "T00:00:00Z"),
      salonId: ctx.salon.id,
      branchId: await currentBranchId(ctx),
      createdById: ctx.user.id,
    },
  });
  await audit(ctx, "expense.create", "Expense", e.id, { name: e.category, total: e.amount });
  revalidatePath("/expenses");
  return ok("Expense added.");
}

export async function deleteExpense(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  const id = String(fd.get("id"));
  const e = await ctx.db.expense.findUnique({ where: { id } });
  if (!e) return fail("Not found.");
  await ctx.db.expense.delete({ where: { id } });
  await audit(ctx, "expense.delete", "Expense", id, { name: e.category, total: e.amount });
  revalidatePath("/expenses");
  return ok("Deleted.");
}
