import Link from "next/link";
import { Empty, PageHeader, Table } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { dhakaDateString, displayPhone, whatsappLink } from "@/lib/format";

export const metadata = { title: "Birthdays" };

const DAYS_AHEAD = 14;

export default async function BirthdaysPage() {
  const ctx = await requireUser();
  const customers = await ctx.db.customer.findMany({
    where: { deletedAt: null, dob: { not: null }, status: { not: "ARCHIVED" } },
    select: { id: true, name: true, phone: true, dob: true },
  });
  const today = new Date(dhakaDateString() + "T00:00:00Z");
  const year = today.getUTCFullYear();

  const upcoming = customers
    .map((c) => {
      const d = c.dob!;
      let next = new Date(Date.UTC(year, d.getUTCMonth(), d.getUTCDate()));
      if (next < today) next = new Date(Date.UTC(year + 1, d.getUTCMonth(), d.getUTCDate()));
      const inDays = Math.round((next.getTime() - today.getTime()) / 86400000);
      return { ...c, next, inDays, age: next.getUTCFullYear() - d.getUTCFullYear() };
    })
    .filter((c) => c.inDays <= DAYS_AHEAD)
    .sort((a, b) => a.inDays - b.inDays);

  return (
    <>
      <PageHeader title="Birthdays" description={`Customers with a birthday in the next ${DAYS_AHEAD} days. Add a date of birth on the customer page to see them here.`} />
      {upcoming.length === 0 ? (
        <Empty>No birthdays coming up.</Empty>
      ) : (
        <Table>
          <thead><tr><th>Customer</th><th>Birthday</th><th>Phone</th><th>Wish them</th></tr></thead>
          <tbody>
            {upcoming.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/customers/${c.id}`} className="font-medium hover:underline">{c.name}</Link></td>
                <td>
                  {c.next.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}
                  <span className="text-stone-500"> · {c.inDays === 0 ? "today" : c.inDays === 1 ? "tomorrow" : `in ${c.inDays} days`}</span>
                </td>
                <td><a href={`tel:${c.phone}`} className="tabular-nums hover:underline">{displayPhone(c.phone)}</a></td>
                <td>
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 hover:underline"
                    href={whatsappLink(c.phone, `Happy birthday ${c.name.split(" ")[0]}! 🎉 Wishing you a great year from all of us at ${ctx.salon.name}. Come in this week for a birthday treat!`)}
                  >
                    WhatsApp
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
