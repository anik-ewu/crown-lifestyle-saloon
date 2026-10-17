// No "server-only": prisma/seed.ts uses this too.
import type { Plan, Prisma } from "@/generated/prisma/client";
import { STARTER_SERVICES } from "@/lib/starter";

export type NewSalon = {
  salonName: string;
  address: string;
  salonPhone: string;
  salonEmail?: string | null;
  ownerName: string;
  ownerPhone: string;
  ownerEmail?: string | null;
  passwordHash: string;
  mustChangePassword: boolean;
  plan: Plan;
  trialEndsAt?: Date | null;
  paidUntil?: Date | null;
  logoUrl?: string | null;
  invoicePrefix?: string;
};

/** Salon + "Main" branch + starter services + owner admin, in one transaction. */
export async function createSalonWithOwner(tx: Prisma.TransactionClient, s: NewSalon) {
  const prefix = s.invoicePrefix ?? (s.salonName.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "INV");
  const salon = await tx.salon.create({
    data: {
      name: s.salonName,
      phone: s.salonPhone,
      email: s.salonEmail ?? s.ownerEmail ?? null,
      address: s.address,
      invoicePrefix: prefix,
      logoUrl: s.logoUrl ?? null,
      plan: s.plan,
      trialEndsAt: s.trialEndsAt ?? null,
      paidUntil: s.paidUntil ?? null,
      branches: { create: { name: "Main", address: s.address, phone: s.salonPhone } },
    },
  });
  await tx.service.createMany({
    data: STARTER_SERVICES.map(([category, name, taka]) => ({ salonId: salon.id, category, name, price: taka * 100 })),
  });
  const owner = await tx.user.create({
    data: {
      salonId: salon.id,
      name: s.ownerName,
      phone: s.ownerPhone,
      email: s.ownerEmail ?? null,
      role: "ADMIN",
      passwordHash: s.passwordHash,
      mustChangePassword: s.mustChangePassword,
    },
  });
  return { salon, owner };
}
