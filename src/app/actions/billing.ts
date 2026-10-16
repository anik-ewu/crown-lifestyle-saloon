"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, parseForm, type ActionState } from "@/lib/action";
import { audit } from "@/lib/audit";
import { requireAdmin, requireUser } from "@/lib/auth";
import { currentBranchId } from "@/lib/branch";
import { dhakaDateString } from "@/lib/format";

const lineSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.enum(["SERVICE", "PACKAGE"]),
    id: z.string().min(1),
    qty: z.number().int().min(1).max(20),
    staffId: z.string().nullable(),
  }),
  z.object({
    kind: z.literal("CUSTOM"),
    name: z.string().trim().min(1).max(100),
    serviceIds: z.array(z.string()).min(2).max(30),
    price: z.number().int().min(0).max(100_000_000),
    save: z.boolean(),
    staffId: z.string().nullable(),
  }),
]);

const billSchema = z.object({
  customerId: z.string().min(1, "Choose a customer"),
  lines: z.array(lineSchema).min(1, "Add at least one service").max(40),
  discountType: z.enum(["NONE", "FLAT", "PERCENT"]),
  discountValue: z.number().int().min(0),
  discountNote: z.string().max(200).optional(),
  payments: z
    .array(z.object({ method: z.enum(["CASH", "CARD", "BKASH", "NAGAD", "OTHER"]), amount: z.number().int().min(0) }))
    .min(1)
    .max(5),
});

export type BillPayload = z.infer<typeof billSchema>;

export async function createInvoice(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireUser();
  let raw: unknown;
  try {
    raw = JSON.parse(String(fd.get("payload")));
  } catch {
    return fail("Invalid bill.");
  }
  const parsed = billSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const bill = parsed.data;

  const customer = await ctx.db.customer.findUnique({ where: { id: bill.customerId } });
  if (!customer || customer.deletedAt) return fail("Customer not found.");

  // Look up every price on the server; the browser only sends ids.
  const serviceIds = bill.lines.flatMap((l) => (l.kind === "SERVICE" ? [l.id] : l.kind === "CUSTOM" ? l.serviceIds : []));
  const packageIds = bill.lines.flatMap((l) => (l.kind === "PACKAGE" ? [l.id] : []));
  const staffIds = [...new Set(bill.lines.map((l) => l.staffId).filter((s): s is string => !!s))];
  const [services, packages, staff] = await Promise.all([
    ctx.db.service.findMany({ where: { id: { in: serviceIds } } }),
    ctx.db.package.findMany({ where: { id: { in: packageIds } }, include: { items: { include: { service: true } } } }),
    ctx.db.staffMember.findMany({ where: { id: { in: staffIds }, active: true } }),
  ]);
  const svc = new Map(services.map((s) => [s.id, s]));
  const pkg = new Map(packages.map((p) => [p.id, p]));
  if (staff.length !== staffIds.length) return fail("A selected salon member is no longer active.");

  type Line = {
    itemType: "SERVICE" | "PACKAGE";
    itemId: string;
    nameSnapshot: string;
    unitPrice: number;
    listPrice: number;
    qty: number;
    lineTotal: number;
    staffMemberId: string | null;
    custom?: { serviceIds: string[]; save: boolean };
  };
  const lines: Line[] = [];
  for (const l of bill.lines) {
    if (l.kind === "SERVICE") {
      const s = svc.get(l.id);
      if (!s || !s.active) return fail("A service on this bill is no longer available.");
      lines.push({ itemType: "SERVICE", itemId: s.id, nameSnapshot: s.name, unitPrice: s.price, listPrice: s.price * l.qty, qty: l.qty, lineTotal: s.price * l.qty, staffMemberId: l.staffId });
    } else if (l.kind === "PACKAGE") {
      const p = pkg.get(l.id);
      if (!p || !p.active) return fail("A package on this bill is no longer available.");
      lines.push({ itemType: "PACKAGE", itemId: p.id, nameSnapshot: p.name, unitPrice: p.price, listPrice: p.price * l.qty, qty: l.qty, lineTotal: p.price * l.qty, staffMemberId: l.staffId });
    } else if (l.kind === "CUSTOM") {
      const parts = l.serviceIds.map((id) => svc.get(id));
      if (parts.some((s) => !s)) return fail("A service in the custom package was not found.");
      const listPrice = parts.reduce((sum, s) => sum + s!.price, 0);
      lines.push({ itemType: "PACKAGE", itemId: "", nameSnapshot: l.name, unitPrice: l.price, listPrice, qty: 1, lineTotal: l.price, staffMemberId: l.staffId, custom: { serviceIds: l.serviceIds, save: l.save } });
    }
  }

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  let discountAmount = 0;
  if (bill.discountType === "FLAT") discountAmount = bill.discountValue;
  if (bill.discountType === "PERCENT") {
    if (bill.discountValue > 100) return fail("Discount can't be more than 100%.");
    discountAmount = Math.round((subtotal * bill.discountValue) / 100);
  }
  if (discountAmount > subtotal) return fail("Discount can't be more than the bill.");
  const total = subtotal - discountAmount;

  // Overall discount vs list prices, including cheap custom packages.
  const listTotal = lines.reduce((s, l) => s + l.listPrice, 0);
  const effectivePct = listTotal > 0 ? ((listTotal - total) / listTotal) * 100 : 0;
  const limit = ctx.salon.subAdminDiscountLimitPct;
  if (!ctx.isAdmin && effectivePct > limit + 0.01) {
    return fail(`Total discount is ${effectivePct.toFixed(1)}%. Sub-admins can give up to ${limit}%. Ask an admin.`);
  }

  const payments = bill.payments.filter((p) => p.amount > 0);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  if (total > 0 && paid !== total) return fail("Payments must add up to the total.");

  const branchId = await currentBranchId(ctx);
  const salonId = ctx.salon.id;
  const year = dhakaDateString().slice(0, 4);

  const invoice = await ctx.db.$transaction(async (tx) => {
    for (const l of lines) {
      if (!l.custom) continue;
      const p = await tx.package.create({
        data: {
          salonId,
          name: l.nameSnapshot,
          price: l.unitPrice,
          isCustom: true,
          active: l.custom.save,
          items: { create: l.custom.serviceIds.map((serviceId) => ({ serviceId, salonId })) },
        },
      });
      l.itemId = p.id;
    }
    const { invoiceSeq } = await tx.salon.update({
      where: { id: salonId },
      data: { invoiceSeq: { increment: 1 } },
      select: { invoiceSeq: true },
    });
    const number = `${ctx.salon.invoicePrefix}-${year}-${String(invoiceSeq).padStart(6, "0")}`;
    const created = await tx.invoice.create({
      data: {
        salonId,
        branchId,
        number,
        customerId: customer.id,
        createdById: ctx.user.id,
        subtotal,
        discountType: discountAmount > 0 ? bill.discountType : "NONE",
        discountValue: discountAmount > 0 ? bill.discountValue : 0,
        discountAmount,
        discountNote: bill.discountNote || null,
        total,
        items: {
          create: lines.map((l) => ({
            salonId,
            itemType: l.itemType,
            itemId: l.itemId,
            nameSnapshot: l.nameSnapshot,
            unitPrice: l.unitPrice,
            listPrice: l.listPrice,
            qty: l.qty,
            lineTotal: l.lineTotal,
            staffMemberId: l.staffMemberId,
          })),
        },
        payments: { create: (payments.length ? payments : [{ method: "CASH" as const, amount: 0 }]).map((p) => ({ ...p, salonId })) },
      },
    });
    await tx.customer.update({
      where: { id: customer.id },
      data: { lastVisitAt: created.createdAt, status: customer.status === "SNOOZED" ? "ACTIVE" : customer.status, snoozedUntil: null },
    });
    return created;
  });

  await audit(ctx, "invoice.create", "Invoice", invoice.id, { number: invoice.number, total });
  if (effectivePct > limit + 0.01) {
    await audit(ctx, "invoice.discount_over_limit", "Invoice", invoice.id, { pct: Number(effectivePct.toFixed(1)) });
  }
  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}?new=1`);
}

const reasonSchema = z.object({ id: z.string().min(1), reason: z.string().min(3, "Give a reason").max(300) });

export async function voidInvoice(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  const parsed = parseForm(reasonSchema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const inv = await ctx.db.invoice.findUnique({ where: { id: parsed.data.id } });
  if (!inv || inv.status === "VOID") return fail("Invoice not found or already void.");
  await ctx.db.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: inv.id },
      data: { status: "VOID", voidReason: parsed.data.reason, voidedById: ctx.user.id, voidedAt: new Date() },
    });
    // keep the customer's last visit in line with their remaining paid bills
    const last = await tx.invoice.findFirst({
      where: { customerId: inv.customerId, status: "PAID" },
      orderBy: { createdAt: "desc" },
    });
    await tx.customer.update({ where: { id: inv.customerId }, data: { lastVisitAt: last?.createdAt ?? null } });
  });
  await audit(ctx, "invoice.void", "Invoice", inv.id, { number: inv.number, total: inv.total, reason: parsed.data.reason });
  revalidatePath(`/invoices/${inv.id}`);
  return ok("Invoice voided. It no longer counts in sales.");
}

export async function requestVoid(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireUser();
  const parsed = parseForm(reasonSchema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const inv = await ctx.db.invoice.findUnique({ where: { id: parsed.data.id } });
  if (!inv || inv.status === "VOID") return fail("Invoice not found or already void.");
  await ctx.db.invoice.update({
    where: { id: inv.id },
    data: { voidRequestedAt: new Date(), voidRequestReason: parsed.data.reason, voidRequestedById: ctx.user.id },
  });
  await audit(ctx, "invoice.void_requested", "Invoice", inv.id, { number: inv.number, reason: parsed.data.reason });
  revalidatePath(`/invoices/${inv.id}`);
  return ok("Void requested. An admin will review it.");
}

export async function dismissVoidRequest(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  const id = String(fd.get("id"));
  await ctx.db.invoice.update({ where: { id }, data: { voidRequestedAt: null, voidRequestReason: null, voidRequestedById: null } });
  await audit(ctx, "invoice.void_request_dismissed", "Invoice", id);
  revalidatePath(`/invoices/${id}`);
  return ok("Request dismissed.");
}
