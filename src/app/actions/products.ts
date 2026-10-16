"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, parseForm, type ActionState } from "@/lib/action";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { checkbox, optionalText, takaField } from "@/lib/schemas";

const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

const productSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  sku: optionalText(40),
  price: takaField,
  lowStockAt: int(0, 10000),
  active: checkbox,
});

export async function createProduct(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  fd.set("active", "on");
  const parsed = parseForm(productSchema.extend({ stock: int(0, 100000) }), fd);
  if (!parsed.ok) return fail(parsed.error);
  const { stock, ...data } = parsed.data;
  const p = await ctx.db.$transaction(async (tx) => {
    const p = await tx.product.create({ data: { ...data, stock, salonId: ctx.salon.id } });
    if (stock > 0) {
      await tx.stockMovement.create({
        data: { salonId: ctx.salon.id, productId: p.id, change: stock, reason: "Opening stock", userId: ctx.user.id },
      });
    }
    return p;
  });
  await audit(ctx, "product.create", "Product", p.id, { name: p.name });
  revalidatePath("/products");
  return ok(`Added ${p.name}.`);
}

export async function updateProduct(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  const id = String(fd.get("id"));
  const parsed = parseForm(productSchema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const before = await ctx.db.product.findUnique({ where: { id } });
  if (!before) return fail("Product not found.");
  await ctx.db.product.update({ where: { id }, data: parsed.data });
  if (before.price !== parsed.data.price) {
    await audit(ctx, "price.change", "Product", id, { itemName: parsed.data.name, oldPrice: before.price, newPrice: parsed.data.price });
  }
  revalidatePath("/products");
  return ok("Saved.");
}

const adjustSchema = z.object({
  id: z.string().min(1),
  change: z.coerce.number().int().min(-100000).max(100000).refine((n) => n !== 0, "Enter a number other than 0"),
  reason: z.string().min(2, "Give a reason").max(100),
});

export async function adjustStock(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  const parsed = parseForm(adjustSchema, fd);
  if (!parsed.ok) return fail(parsed.error);
  const { id, change, reason } = parsed.data;
  const p = await ctx.db.product.findUnique({ where: { id } });
  if (!p) return fail("Product not found.");
  if (p.stock + change < 0) return fail(`Only ${p.stock} in stock.`);
  await ctx.db.$transaction([
    ctx.db.product.update({ where: { id }, data: { stock: { increment: change } } }),
    ctx.db.stockMovement.create({ data: { salonId: ctx.salon.id, productId: id, change, reason, userId: ctx.user.id } }),
  ]);
  await audit(ctx, "stock.adjust", "Product", id, { name: p.name, change, reason });
  revalidatePath("/products");
  return ok(`${p.name}: ${change > 0 ? "+" : ""}${change}.`);
}
