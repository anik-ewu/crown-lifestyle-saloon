import { notFound } from "next/navigation";
import { PrintControls } from "./auto-print";
import { requireUser } from "@/lib/auth";
import { displayPhone, formatDateTime, money, PAYMENT_LABELS } from "@/lib/format";

export const metadata = { title: "Print invoice" };

const PAGE = {
  MM58: { page: "@page { size: 58mm auto; margin: 0 }", width: "48mm", font: "10px" },
  MM80: { page: "@page { size: 80mm auto; margin: 0 }", width: "72mm", font: "11.5px" },
  A4: { page: "@page { size: A4; margin: 15mm }", width: "180mm", font: "13px" },
} as const;

export default async function PrintInvoicePage({ params, searchParams }: PageProps<"/print/invoices/[id]">) {
  const ctx = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const inv = await ctx.db.invoice.findUnique({
    where: { id },
    include: { customer: true, items: { include: { staffMember: true } }, payments: true, branch: true },
  });
  if (!inv) notFound();
  const w = (["MM58", "MM80", "A4"].includes(String(sp.w)) ? String(sp.w) : ctx.salon.receiptWidth) as keyof typeof PAGE;
  const cfg = PAGE[w];
  const s = ctx.salon;
  const thermal = w !== "A4";

  return (
    <div className="bg-white text-black">
      <style>{`${cfg.page} body { background: #fff; } .receipt { width: ${cfg.width}; font-size: ${cfg.font}; }`}</style>
      <div className="py-4 print:py-0">
        <PrintControls auto={sp.auto === "1"} />
        <div className="receipt mx-auto px-[2mm] py-[3mm] font-mono leading-snug">
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="" className={`mx-auto mb-1 rounded-full ${thermal ? "h-14 w-14 grayscale" : "h-20 w-20"}`} />
            <p className="text-[1.25em] font-bold">{s.name}</p>
            <p>{inv.branch.address || s.address}</p>
            <p>{s.phone}</p>
            {s.facebookUrl && <p className="break-all">fb: {s.facebookUrl.replace(/^https?:\/\/(www\.)?/, "")}</p>}
          </div>
          <hr className="my-2 border-dashed border-black" />
          <p className="flex justify-between"><span>Invoice</span><span className="font-bold">{inv.number}</span></p>
          <p className="flex justify-between"><span>Date</span><span>{formatDateTime(inv.createdAt)}</span></p>
          <p className="flex justify-between"><span>Customer</span><span>{inv.customer.name}</span></p>
          {!inv.customer.deletedAt && <p className="flex justify-between"><span>Phone</span><span>{displayPhone(inv.customer.phone)}</span></p>}
          {inv.status === "VOID" && <p className="my-1 text-center text-[1.4em] font-bold">*** VOID ***</p>}
          <hr className="my-2 border-dashed border-black" />
          <table className="w-full">
            <tbody>
              {inv.items.map((i) => (
                <tr key={i.id} className="align-top">
                  <td className="pb-1">
                    {i.nameSnapshot}{i.qty > 1 && ` ×${i.qty}`}
                    {i.staffMember && <span className="block text-[0.85em]">by {i.staffMember.name}</span>}
                  </td>
                  <td className="pb-1 text-right whitespace-nowrap">{money(i.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <hr className="my-2 border-dashed border-black" />
          <p className="flex justify-between"><span>Subtotal</span><span>{money(inv.subtotal)}</span></p>
          {inv.discountAmount > 0 && (
            <p className="flex justify-between"><span>Discount{inv.discountType === "PERCENT" && ` ${inv.discountValue}%`}</span><span>-{money(inv.discountAmount)}</span></p>
          )}
          <p className="mt-1 flex justify-between text-[1.2em] font-bold"><span>TOTAL</span><span>{money(inv.total)}</span></p>
          {inv.payments.filter((p) => p.amount > 0).map((p) => (
            <p key={p.id} className="flex justify-between"><span>Paid · {PAYMENT_LABELS[p.method]}</span><span>{money(p.amount)}</span></p>
          ))}
          <hr className="my-2 border-dashed border-black" />
          <p className="text-center">{s.invoiceFooter || "Thank you for visiting!"}</p>
        </div>
      </div>
    </div>
  );
}
