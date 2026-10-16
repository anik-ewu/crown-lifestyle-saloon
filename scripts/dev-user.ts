// Creates or resets a login on the LOCAL database for manual testing.
//   DEV_PHONE=01700000001 DEV_PASSWORD=... DEV_ROLE=SUB_ADMIN npx tsx scripts/dev-user.ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { normalizePhone } from "../src/lib/format";
import { hashPassword } from "../src/lib/password";

async function main() {
  const url = process.env.DATABASE_URL!;
  if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error("dev-user only runs against a local database");
  const phone = normalizePhone(process.env.DEV_PHONE ?? "");
  const password = process.env.DEV_PASSWORD ?? "";
  const role = process.env.DEV_ROLE === "SUB_ADMIN" ? "SUB_ADMIN" : "ADMIN";
  if (!phone || password.length < 10) throw new Error("Set DEV_PHONE and DEV_PASSWORD (10+ chars)");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const salon = await prisma.salon.findFirstOrThrow();
  const passwordHash = await hashPassword(password);
  await prisma.user.upsert({
    where: { phone },
    update: { passwordHash, active: true, mustChangePassword: false, failedLogins: 0, lockedUntil: null, role },
    create: { salonId: salon.id, name: role === "ADMIN" ? "Test Admin" : "Test Desk", phone, role, passwordHash },
  });
  console.log(`Ready: ${phone} (${role})`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
