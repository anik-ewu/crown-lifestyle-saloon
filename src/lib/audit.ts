import "server-only";
import { clientIp, type Ctx } from "@/lib/auth";

export async function audit(
  ctx: Ctx,
  action: string,
  entity?: string,
  entityId?: string,
  meta?: Record<string, unknown>,
) {
  await ctx.db.auditLog.create({
    data: {
      salonId: ctx.salon.id,
      userId: ctx.user.id,
      userName: ctx.user.name,
      action,
      entity,
      entityId,
      meta: meta as object | undefined,
      ip: await clientIp(),
    },
  });
}
