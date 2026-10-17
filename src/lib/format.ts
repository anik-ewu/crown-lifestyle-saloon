// Shared by server and client code: no server-only imports here.

export const TZ = "Asia/Dhaka";
// Bangladesh has no DST, so local time is always UTC+6.
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

/** ৳1,250 or ৳1,250.50 from poisha. */
export function money(poisha: number): string {
  if (poisha < 0) return "−" + money(-poisha);
  const taka = poisha / 100;
  const hasFraction = poisha % 100 !== 0;
  return (
    "৳" +
    taka.toLocaleString("en-IN", {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2,
    })
  );
}

/** "1,250.5" taka → 125050 poisha. Returns NaN for junk. */
export function toPoisha(input: string | number): number {
  const n = typeof input === "number" ? input : Number(String(input).replace(/[,\s৳]/g, ""));
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

export function toTakaInput(poisha: number): string {
  return String(poisha / 100);
}

/**
 * Normalises Bangladeshi mobile numbers to +8801XXXXXXXXX.
 * Returns null when the number isn't a valid BD mobile.
 */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("880")) d = d.slice(3);
  if (d.startsWith("1") && d.length === 10) d = "0" + d;
  if (!/^01[3-9]\d{8}$/.test(d)) return null;
  return "+88" + d;
}

/** +8801906336438 → 01906-336438 */
export function displayPhone(e164: string): string {
  const local = e164.startsWith("+88") ? e164.slice(3) : e164;
  return local.length === 11 ? `${local.slice(0, 5)}-${local.slice(5)}` : local;
}

export function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString("en-GB", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** YYYY-MM-DD for a moment, in Dhaka time. */
export function dhakaDateString(d: Date = new Date()): string {
  return new Date(d.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC instant of Dhaka midnight at the start of YYYY-MM-DD. */
export function dhakaMidnight(ymd: string): Date {
  return new Date(Date.parse(ymd + "T00:00:00Z") - DHAKA_OFFSET_MS);
}

export function dayRange(ymd: string): { gte: Date; lt: Date } {
  const gte = dhakaMidnight(ymd);
  return { gte, lt: new Date(gte.getTime() + 24 * 60 * 60 * 1000) };
}

/** month is 1-12 */
export function monthRange(year: number, month: number): { gte: Date; lt: Date } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;
  return { gte: dhakaMidnight(`${year}-${pad(month)}-01`), lt: dhakaMidnight(next) };
}

export function yearRange(year: number): { gte: Date; lt: Date } {
  return { gte: dhakaMidnight(`${year}-01-01`), lt: dhakaMidnight(`${year + 1}-01-01`) };
}

export function daysAgo(n: number, from: Date = new Date()): Date {
  return new Date(from.getTime() - n * 24 * 60 * 60 * 1000);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

export const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  BKASH: "bKash",
  NAGAD: "Nagad",
  OTHER: "Other",
};

/** Free click-to-chat link; opens WhatsApp with the message typed in. */
export function whatsappLink(e164: string, text: string): string {
  return `https://wa.me/${e164.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
