"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, parseForm, type ActionState } from "@/lib/action";
import { requireUser } from "@/lib/auth";
import { currentBranchId } from "@/lib/branch";
import { dhakaMidnight, normalizePhone } from "@/lib/format";
import { optionalText } from "@/lib/schemas";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a time"),
  durationMin: z.coerce.number().int().min(5).max(480),
  phone: z.string().optional(),
  name: z.string().max(100).optional(),
  staffMemberId: z.string().optional(),
  service: optionalText(100),
  note: optionalText(300),
});

export async function createAppointment(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireUser();
  const parsed = parseForm(schema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const d = parsed.data;
  const [h, m] = d.time.split(":").map(Number);
  const startsAt = new Date(dhakaMidnight(d.date).getTime() + (h * 60 + m) * 60000);

  let phone: string | null = null;
  if (d.phone) {
    phone = normalizePhone(d.phone);
    if (!phone) return fail("Enter a valid mobile number or leave it empty.");
  }
  const customer = phone ? await ctx.db.customer.findFirst({ where: { phone, deletedAt: null } }) : null;
  const name = d.name?.trim() || customer?.name;
  if (!name) return fail("Enter the customer's name.");

  let staffMemberId: string | null = null;
  if (d.staffMemberId) {
    const s = await ctx.db.staffMember.findFirst({ where: { id: d.staffMemberId, active: true } });
    if (!s) return fail("Salon member not found.");
    staffMemberId = s.id;
    const end = new Date(startsAt.getTime() + d.durationMin * 60000);
    const clash = await ctx.db.appointment.findFirst({
      where: { staffMemberId, status: "BOOKED", startsAt: { lt: end, gte: new Date(startsAt.getTime() - 8 * 3600000) } },
      orderBy: { startsAt: "desc" },
    });
    if (clash && clash.startsAt.getTime() + clash.durationMin * 60000 > startsAt.getTime()) {
      return fail(`${s.name} already has ${clash.name} booked at that time.`);
    }
  }

  await ctx.db.appointment.create({
    data: {
      salonId: ctx.salon.id,
      branchId: await currentBranchId(ctx),
      customerId: customer?.id ?? null,
      name,
      phone,
      staffMemberId,
      startsAt,
      durationMin: d.durationMin,
      service: d.service,
      note: d.note,
      createdById: ctx.user.id,
    },
  });
  revalidatePath("/appointments");
  return ok(`Booked ${name}.`);
}

export async function setAppointmentStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireUser();
  const id = String(fd.get("id"));
  const status = z.enum(["BOOKED", "DONE", "CANCELLED", "NO_SHOW"]).safeParse(fd.get("status"));
  if (!status.success) return fail("Invalid status.");
  const a = await ctx.db.appointment.findUnique({ where: { id } });
  if (!a) return fail("Not found.");
  await ctx.db.appointment.update({ where: { id }, data: { status: status.data } });
  revalidatePath("/appointments");
  return ok();
}
