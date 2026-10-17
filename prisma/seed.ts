// Usage:
//   npm run db:seed            creates your platform workspace ("<APP_NAME> HQ") and your owner login
//   npm run db:seed -- --demo  also adds "Crown LifeStyle Saloon" as a client salon with fake
//                              staff, customers and 15 months of bills (local database only)
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { APP_NAME } from "../src/lib/brand";
import { normalizePhone } from "../src/lib/format";
import { createSalonWithOwner } from "../src/lib/onboarding";
import { hashPassword } from "../src/lib/password";

const url = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const HOURS = {
  sun: ["10:00", "22:00"], mon: ["10:00", "22:00"], tue: ["10:00", "22:00"], wed: ["10:00", "22:00"],
  thu: ["10:00", "23:00"], fri: ["10:00", "22:00"], sat: ["10:00", "23:00"],
};

function login(prefix: string) {
  const phone = normalizePhone(process.env[`${prefix}_PHONE`] ?? "");
  const password = process.env[`${prefix}_PASSWORD`] ?? "";
  if (!phone || password.length < 10) throw new Error(`Set ${prefix}_PHONE and ${prefix}_PASSWORD (10+ chars) in .env`);
  return { phone, password };
}

async function main() {
  if (!(await prisma.salon.findFirst({ where: { plan: "INTERNAL" } }))) {
    const { phone, password } = login("PLATFORM_OWNER");
    if (await prisma.user.findUnique({ where: { phone } })) throw new Error(`${phone} already has an account`);
    const { salon } = await prisma.$transaction((tx) =>
      hashPassword(password).then((passwordHash) =>
        createSalonWithOwner(tx, {
          salonName: `${APP_NAME} HQ`,
          address: "Dhaka, Bangladesh",
          salonPhone: phone,
          ownerName: process.env.PLATFORM_OWNER_NAME || "Platform owner",
          ownerPhone: phone,
          ownerEmail: process.env.PLATFORM_OWNER_EMAIL?.toLowerCase() || null,
          passwordHash,
          mustChangePassword: false,
          plan: "INTERNAL",
          invoicePrefix: "HQ",
        }),
      ),
    );
    console.log(`Created your workspace "${salon.name}" and owner login ${phone}`);
    const admins = (process.env.PLATFORM_ADMIN_PHONES ?? "").split(",").map((p) => normalizePhone(p));
    if (!admins.includes(phone)) console.log(`Add ${phone} to PLATFORM_ADMIN_PHONES so you can open /platform`);
  }

  if (process.argv.includes("--demo")) await demoCrown();
}

/** Crown as the first client: Pro, free for 12 months. Local only. */
async function demoCrown() {
  if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error("--demo only runs against a local database");
  let crown = await prisma.salon.findFirst({ where: { name: "Crown LifeStyle Saloon" } });
  if (!crown) {
    const { phone, password } = login("DEMO_CROWN_OWNER");
    const address = "A.K Haris Villa, House #02, Road #03, Block #F, Banasree, Rampura, Dhaka-1219";
    const paidUntil = new Date();
    paidUntil.setUTCFullYear(paidUntil.getUTCFullYear() + 1);
    const passwordHash = await hashPassword(password);
    crown = await prisma.$transaction(async (tx) => {
      const { salon } = await createSalonWithOwner(tx, {
        salonName: "Crown LifeStyle Saloon",
        address,
        salonPhone: "+880 1906-336438",
        salonEmail: "crownlifestylesaloon@gmail.com",
        ownerName: "Crown owner",
        ownerPhone: phone,
        passwordHash,
        mustChangePassword: false,
        plan: "PRO",
        paidUntil,
        logoUrl: "/logo.jpg",
        invoicePrefix: "CLS",
      });
      await tx.branch.updateMany({ where: { salonId: salon.id }, data: { name: "Banasree", openingHours: HOURS } });
      return tx.salon.update({
        where: { id: salon.id },
        data: {
          facebookUrl: "https://www.facebook.com/profile.php?id=61591904007465",
          invoiceFooter: "Thank you for visiting Crown LifeStyle Saloon!",
          loyaltyPointsPer100: 5,
        },
      });
    });
    console.log(`Created client salon "${crown.name}" (Pro, free until ${paidUntil.toISOString().slice(0, 10)}), owner ${phone}`);
  }
  await demo(crown.id);
}

async function demo(salonId: string) {
  if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error("--demo only runs against a local database");
  if ((await prisma.invoice.count({ where: { salonId } })) > 0) {
    console.log("Demo data skipped: invoices already exist");
    return;
  }
  const branch = (await prisma.branch.findFirst({ where: { salonId } }))!;
  const services = await prisma.service.findMany({ where: { salonId } });
  const staff = await Promise.all(
    ["Rakib", "Sumon", "Nadia", "Faruk"].map((name, i) =>
      prisma.staffMember.create({ data: { salonId, name, title: i === 2 ? "Beautician" : "Barber", commissionPct: 30 } }),
    ),
  );
  const admin = (await prisma.user.findFirst({ where: { salonId, role: "ADMIN" } }))!;
  const first = ["Arif", "Tanvir", "Sakib", "Rafi", "Imran", "Nusrat", "Mitu", "Shuvo", "Hasan", "Jamil", "Rumana", "Fahim", "Nabil", "Sabbir", "Tania"];
  const last = ["Ahmed", "Hossain", "Islam", "Rahman", "Khan", "Chowdhury", "Karim", "Uddin"];
  let rand = 42;
  const rnd = () => ((rand = (rand * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

  const customers = [];
  for (let i = 0; i < 60; i++) {
    customers.push(
      await prisma.customer.create({
        data: {
          salonId,
          name: `${pick(first)} ${pick(last)}`,
          phone: `+88017${String(10000000 + i * 7919).slice(0, 8)}`,
          address: "Banasree, Dhaka",
        },
      }),
    );
  }

  let seq = 0;
  const now = Date.now();
  for (const c of customers) {
    const visits = 1 + Math.floor(rnd() * 8);
    // some customers stop coming 4-12 months ago, so the reminder board has work
    const lapsed = rnd() < 0.3;
    let lastAt: Date | null = null;
    for (let v = 0; v < visits; v++) {
      const daysBack = lapsed ? 120 + Math.floor(rnd() * 300) : Math.floor(rnd() * 450);
      const at = new Date(now - daysBack * 86400000 - Math.floor(rnd() * 8) * 3600000);
      const items = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => pick(services));
      const subtotal = items.reduce((s, x) => s + x.price, 0);
      const discount = rnd() < 0.15 ? Math.round(subtotal * 0.1) : 0;
      const total = subtotal - discount;
      seq++;
      await prisma.invoice.create({
        data: {
          salonId,
          branchId: branch.id,
          number: `CLS-${at.getUTCFullYear()}-${String(seq).padStart(6, "0")}`,
          customerId: c.id,
          createdById: admin.id,
          subtotal,
          discountType: discount ? "PERCENT" : "NONE",
          discountValue: discount ? 10 : 0,
          discountAmount: discount,
          total,
          createdAt: at,
          items: {
            create: items.map((s) => ({
              salonId, itemType: "SERVICE" as const, itemId: s.id, nameSnapshot: s.name,
              unitPrice: s.price, listPrice: s.price, qty: 1, lineTotal: s.price, staffMemberId: pick(staff).id,
            })),
          },
          payments: { create: { salonId, method: rnd() < 0.6 ? "CASH" : pick(["BKASH", "CARD", "NAGAD"] as const), amount: total } },
        },
      });
      if (!lastAt || at > lastAt) lastAt = at;
    }
    await prisma.customer.update({ where: { id: c.id }, data: { lastVisitAt: lastAt } });
  }
  await prisma.salon.update({ where: { id: salonId }, data: { invoiceSeq: seq } });
  console.log(`Demo: ${staff.length} staff, ${customers.length} customers, ${seq} invoices`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
