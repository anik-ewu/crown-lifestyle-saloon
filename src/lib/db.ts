import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Unscoped client. Only auth, seeding and platform code may use it directly;
// everything else goes through forSalon().
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Models that carry salonId. Keep in sync with prisma/schema.prisma.
const TENANT_MODELS = new Set([
  "Branch",
  "User",
  "StaffMember",
  "Customer",
  "Service",
  "Package",
  "PackageItem",
  "PriceHistory",
  "Invoice",
  "InvoiceItem",
  "Payment",
  "AuditLog",
  "ReminderLog",
  "Product",
  "StockMovement",
  "Appointment",
  "Expense",
  "SubscriptionPayment",
]);

/**
 * A client that adds `salonId` to every top-level read and write on tenant
 * models, so a query cannot reach another salon's rows. Nested creates must
 * still set salonId themselves.
 */
export function forSalon(salonId: string) {
  return prisma.$extends({
    name: "tenant",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const a = (args ?? {}) as any;
          switch (operation) {
            case "create":
              a.data = { ...a.data, salonId };
              break;
            case "createMany":
            case "createManyAndReturn":
              a.data = (Array.isArray(a.data) ? a.data : [a.data]).map(
                (d: object) => ({ ...d, salonId }),
              );
              break;
            case "upsert":
              a.where = { ...a.where, salonId };
              a.create = { ...a.create, salonId };
              break;
            default:
              a.where = { ...a.where, salonId };
          }
          return query(a);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof forSalon>;
