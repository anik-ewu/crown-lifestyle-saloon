import "server-only";
import type { Ctx } from "@/lib/auth";
import { daysAgo } from "@/lib/format";

/**
 * Customers due a reminder call: no visit for `reminderDays`, and either
 * active or snoozed with the snooze now over.
 */
export function dueWhere(ctx: Ctx, now = new Date()) {
  const cutoff = daysAgo(ctx.salon.reminderDays, now);
  return {
    deletedAt: null,
    AND: [
      {
        OR: [
          { status: "ACTIVE" as const },
          { status: "SNOOZED" as const, snoozedUntil: { lte: now } },
        ],
      },
      {
        OR: [{ lastVisitAt: { lt: cutoff } }, { lastVisitAt: null, createdAt: { lt: cutoff } }],
      },
    ],
  };
}
