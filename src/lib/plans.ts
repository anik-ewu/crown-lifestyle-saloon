// Shared by server and client.
import type { Plan } from "@/generated/prisma/enums";

export const PLANS: Record<Plan, { label: string; monthlyTaka: number; maxSubAdmins: number; maxBranches: number; selectable: boolean }> = {
  TRIAL: { label: "Free trial", monthlyTaka: 0, maxSubAdmins: 2, maxBranches: 1, selectable: false },
  BASIC: { label: "Basic", monthlyTaka: 1500, maxSubAdmins: 3, maxBranches: 1, selectable: true },
  PRO: { label: "Pro", monthlyTaka: 3000, maxSubAdmins: 15, maxBranches: 5, selectable: true },
  INTERNAL: { label: "Owner", monthlyTaka: 0, maxSubAdmins: 1000, maxBranches: 100, selectable: false },
};

export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

type SalonPlan = { plan: Plan; trialEndsAt: Date | null; paidUntil: Date | null };

export type SubscriptionState = {
  readOnly: boolean;
  // banner text, or null when there's nothing to say
  notice: string | null;
  tone: "info" | "warn" | "error";
};

export function subscriptionState(s: SalonPlan, now = new Date()): SubscriptionState {
  if (s.plan === "INTERNAL") return { readOnly: false, notice: null, tone: "info" };
  const paidUntil = s.paidUntil?.getTime() ?? 0;
  if (paidUntil > now.getTime()) {
    const days = Math.ceil((paidUntil - now.getTime()) / DAY);
    return days <= 7
      ? { readOnly: false, notice: `Your plan renews in ${days} day${days === 1 ? "" : "s"}.`, tone: "info" }
      : { readOnly: false, notice: null, tone: "info" };
  }
  if (s.plan === "TRIAL") {
    const ends = s.trialEndsAt?.getTime() ?? 0;
    if (ends > now.getTime()) {
      const days = Math.ceil((ends - now.getTime()) / DAY);
      return { readOnly: false, notice: `Free trial: ${days} day${days === 1 ? "" : "s"} left.`, tone: "info" };
    }
    return { readOnly: true, notice: "Your free trial has ended. The app is read-only until a plan is paid.", tone: "error" };
  }
  const graceEnd = paidUntil + GRACE_DAYS * DAY;
  if (graceEnd > now.getTime()) {
    const days = Math.ceil((graceEnd - now.getTime()) / DAY);
    return { readOnly: false, notice: `Payment overdue. The app turns read-only in ${days} day${days === 1 ? "" : "s"}.`, tone: "warn" };
  }
  return { readOnly: true, notice: "Your plan has expired. The app is read-only until payment is made.", tone: "error" };
}

/** Total in taka; 12 months gets 2 months free. */
export function priceFor(plan: Plan, months: number): number {
  const billable = months === 12 ? 10 : months;
  return PLANS[plan].monthlyTaka * billable;
}
