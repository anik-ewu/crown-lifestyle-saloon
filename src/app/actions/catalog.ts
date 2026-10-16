"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, parseForm, type ActionState } from "@/lib/action";
import { audit } from "@/lib/audit";
import { requireAdmin, type Ctx } from "@/lib/auth";
import { checkbox, takaField } from "@/lib/schemas";

const serviceSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  category: z.string().min(1, "Category is required").max(50),
  price: takaField,
  durationMin: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0 && v < 1000), "Duration must be minutes"),
  active: checkbox,
});

async function logPrice(ctx: Ctx, itemType: "SERVICE" | "PACKAGE", itemId: string, itemName: string, oldPrice: number, newPrice: number) {
  if (oldPrice === newPrice) return;
  await ctx.db.priceHistory.create({
    data: { salonId: ctx.salon.id, itemType, itemId, itemName, oldPrice, newPrice, changedById: ctx.user.id },
  });
  await audit(ctx, "price.change", itemType === "SERVICE" ? "Service" : "Package", itemId, { itemName, oldPrice, newPrice });
}

export async function createService(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  fd.set("active", "on");
  const parsed = parseForm(serviceSchema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const s = await ctx.db.service.create({ data: { ...parsed.data, salonId: ctx.salon.id } });
  await audit(ctx, "service.create", "Service", s.id, { name: s.name, price: s.price });
  revalidatePath("/catalog/services");
  return ok(`Added ${s.name}.`);
}

export async function updateService(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  const id = String(fd.get("id"));
  const parsed = parseForm(serviceSchema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const before = await ctx.db.service.findUnique({ where: { id } });
  if (!before) return fail("Service not found.");
  await ctx.db.service.update({ where: { id }, data: parsed.data });
  await logPrice(ctx, "SERVICE", id, parsed.data.name, before.price, parsed.data.price);
  if (before.active !== parsed.data.active) await audit(ctx, parsed.data.active ? "service.activate" : "service.deactivate", "Service", id);
  revalidatePath("/catalog/services");
  return ok("Saved.");
}

const packageSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  price: takaField,
  active: checkbox,
});

function serviceIds(fd: FormData): string[] {
  return [...new Set(fd.getAll("serviceId").map(String))].slice(0, 30);
}

export async function createPackage(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  fd.set("active", "on");
  const parsed = parseForm(packageSchema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const ids = serviceIds(fd);
  if (ids.length < 2) return fail("Pick at least two services.");
  const found = await ctx.db.service.count({ where: { id: { in: ids } } });
  if (found !== ids.length) return fail("Some services were not found.");
  const pkg = await ctx.db.package.create({
    data: {
      ...parsed.data,
      salonId: ctx.salon.id,
      items: { create: ids.map((serviceId) => ({ serviceId, salonId: ctx.salon.id })) },
    },
  });
  await audit(ctx, "package.create", "Package", pkg.id, { name: pkg.name, price: pkg.price });
  revalidatePath("/catalog/packages");
  return ok(`Added ${pkg.name}.`);
}

export async function updatePackage(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  const id = String(fd.get("id"));
  const parsed = parseForm(packageSchema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const ids = serviceIds(fd);
  if (ids.length < 2) return fail("Pick at least two services.");
  const found = await ctx.db.service.count({ where: { id: { in: ids } } });
  if (found !== ids.length) return fail("Some services were not found.");
  const before = await ctx.db.package.findUnique({ where: { id } });
  if (!before) return fail("Package not found.");
  await ctx.db.$transaction([
    ctx.db.packageItem.deleteMany({ where: { packageId: id } }),
    ctx.db.package.update({
      where: { id },
      data: {
        ...parsed.data,
        // saving a custom package from the catalog page makes it a regular one
        isCustom: false,
        items: { create: ids.map((serviceId) => ({ serviceId, salonId: ctx.salon.id })) },
      },
    }),
  ]);
  await logPrice(ctx, "PACKAGE", id, parsed.data.name, before.price, parsed.data.price);
  revalidatePath("/catalog/packages");
  return ok("Saved.");
}
