// Usage:
//   npm run db:seed            creates the salon, Banasree branch, first admin and starter services
//   npm run db:seed -- --demo  also adds fake staff, customers and 15 months of bills (local only)
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { normalizePhone } from "../src/lib/format";
import { hashPassword } from "../src/lib/password";

const url = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const HOURS = {
  sun: ["10:00", "22:00"], mon: ["10:00", "22:00"], tue: ["10:00", "22:00"], wed: ["10:00", "22:00"],
  thu: ["10:00", "23:00"], fri: ["10:00", "22:00"], sat: ["10:00", "23:00"],
};

// Starter list; prices are placeholders for the admin to change.
const SERVICES: [string, string, number][] = [
  ["Hair", "Haircut", 300], ["Hair", "Kids haircut", 200], ["Hair", "Hair wash & blow dry", 250],
  ["Hair", "Hair colour", 1200], ["Hair", "Hair spa", 1000], ["Hair", "Hair straightening", 3000],
  ["Beard", "Beard trim", 150], ["Beard", "Clean shave", 150], ["Beard", "Beard colour", 400],
  ["Skin", "Facial", 1200], ["Skin", "Face cleanup", 600], ["Skin", "Face massage", 300],
  ["Spa", "Head massage", 300], ["Spa", "Body massage", 1500], ["Spa", "Manicure", 500], ["Spa", "Pedicure", 600],
];

async function main() {
  let salon = await prisma.salon.findFirst();
  if (!salon) {
    salon = await prisma.salon.create({
      data: {
        name: "Crown LifeStyle Saloon",
        phone: "+880 1906-336438",
        email: "crownlifestylesaloon@gmail.com",
        address: "A.K Haris Villa, House #02, Road #03, Block #F, Banasree, Rampura, Dhaka-1219",
        facebookUrl: "https://www.facebook.com/profile.php?id=61591904007465",
        invoicePrefix: "CLS",
        invoiceFooter: "Thank you for visiting Crown LifeStyle Saloon!",
        branches: {
          create: {
            name: "Banasree",
            address: "A.K Haris Villa, House #02, Road #03, Block #F, Banasree, Rampura, Dhaka-1219",
            phone: "+8801906336438",
            openingHours: HOURS,
          },
        },
      },
    });
    console.log("Created salon", salon.name);
  }

  const phone = normalizePhone(process.env.SEED_ADMIN_PHONE ?? "");
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (!phone || password.length < 10) throw new Error("Set SEED_ADMIN_PHONE and SEED_ADMIN_PASSWORD (10+ chars) in .env");
  if (!(await prisma.user.findUnique({ where: { phone } }))) {
    await prisma.user.create({
      data: {
        salonId: salon.id,
        name: "Owner",
        phone,
        email: process.env.SEED_ADMIN_EMAIL?.toLowerCase() || null,
        role: "ADMIN",
        passwordHash: await hashPassword(password),
      },
    });
    console.log("Created admin", phone);
  }

  if ((await prisma.service.count({ where: { salonId: salon.id } })) === 0) {
    await prisma.service.createMany({
      data: SERVICES.map(([category, name, taka]) => ({ salonId: salon.id, category, name, price: taka * 100 })),
    });
    console.log(`Added ${SERVICES.length} starter services`);
  }

  if (process.argv.includes("--demo")) await demo(salon.id);
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
      prisma.staffMember.create({ data: { salonId, name, title: i === 2 ? "Beautician" : "Barber" } }),
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
