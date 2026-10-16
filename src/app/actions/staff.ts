"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, parseForm, type ActionState } from "@/lib/action";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";
import { checkbox, optionalText } from "@/lib/schemas";

const staffSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  phone: z
    .string()
    .optional()
    .transform((v, c) => {
      if (!v) return null;
      const p = normalizePhone(v);
      if (!p) {
        c.addIssue({ code: "custom", message: "Invalid phone number" });
        return z.NEVER;
      }
      return p;
    }),
  title: optionalText(60),
  commissionPct: z.coerce.number().int().min(0).max(100).default(0),
  active: checkbox,
});

export async function createStaff(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  fd.set("active", "on");
  const parsed = parseForm(staffSchema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const branchId = String(fd.get("branchId") || "") || null;
  const m = await ctx.db.staffMember.create({ data: { ...parsed.data, branchId, salonId: ctx.salon.id } });
  await audit(ctx, "staff.create", "StaffMember", m.id, { name: m.name });
  revalidatePath("/staff");
  return ok(`Added ${m.name}.`);
}

export async function updateStaff(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  const id = String(fd.get("id"));
  const parsed = parseForm(staffSchema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const before = await ctx.db.staffMember.findUnique({ where: { id } });
  if (!before) return fail("Not found.");
  await ctx.db.staffMember.update({ where: { id }, data: parsed.data });
  if (before.active !== parsed.data.active)
    await audit(ctx, parsed.data.active ? "staff.activate" : "staff.deactivate", "StaffMember", id, { name: before.name });
  revalidatePath("/staff");
  return ok("Saved.");
}
