import { z } from "zod";
import { normalizePhone, toPoisha } from "@/lib/format";

export const phoneField = z
  .string()
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) {
      ctx.addIssue({ code: "custom", message: "Enter a valid Bangladeshi mobile number (01XXXXXXXXX)" });
      return z.NEVER;
    }
    return p;
  });

export const optionalText = (max = 500) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

/** Taka amount typed by a person → poisha. */
export const takaField = z.string().transform((v, ctx) => {
  const p = toPoisha(v);
  if (!Number.isFinite(p) || p < 0 || p > 100_000_000) {
    ctx.addIssue({ code: "custom", message: "Enter a valid amount" });
    return z.NEVER;
  }
  return p;
});

export const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");

export const dateField = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      ctx.addIssue({ code: "custom", message: "Invalid date" });
      return z.NEVER;
    }
    return new Date(v + "T00:00:00Z");
  });

export const customerSchema = z.object({
  phone: phoneField,
  name: z.string().min(1, "Name is required").max(100),
  address: optionalText(300),
  gender: z.enum(["", "male", "female", "other"]).optional().transform((v) => v || null),
  dob: dateField,
  notes: optionalText(1000),
});
