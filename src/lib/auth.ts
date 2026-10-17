import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { forSalon, prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/format";
import { hashPassword, verifyPassword } from "@/lib/password";
import { verifyTotp } from "@/lib/totp";
import { subscriptionState } from "@/lib/plans";

export { hashPassword, verifyPassword };
import type { Role } from "@/generated/prisma/client";

const COOKIE = "cls_session";
const SESSION_DAYS = 7;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const IP_ATTEMPTS_PER_15_MIN = 20;

// A real hash to compare against when the user doesn't exist, so response time
// doesn't reveal which phone numbers have accounts.
let dummyHash: Promise<string> | undefined;
function getDummyHash() {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  return dummyHash;
}

/** Readable temporary password, e.g. "kite-4821-rose". */
export function generateTempPassword(): string {
  const words = ["kite", "rose", "lamp", "moon", "pearl", "gold", "river", "comb", "silk", "mint", "star", "leaf"];
  const pick = () => words[randomBytes(1)[0] % words.length];
  const digits = String(randomBytes(2).readUInt16BE(0) % 10000).padStart(4, "0");
  return `${pick()}-${digits}-${pick()}`;
}

export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "Password must be at least 10 characters.";
  if (pw.length > 128) return "Password is too long.";
  return null;
}

// ---------- request info ----------

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

// ---------- sessions ----------

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string, verified = true) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const h = await headers();
  await prisma.session.create({
    data: {
      id: hashToken(token),
      userId,
      verified,
      // an unverified (waiting for 2FA) session only lives 10 minutes
      expiresAt: verified ? expiresAt : new Date(Date.now() + 10 * 60 * 1000),
      ip: await clientIp(),
      userAgent: h.get("user-agent")?.slice(0, 200),
    },
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(COOKIE);
}

export async function destroyAllSessions(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
}

const loadAnySession = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { include: { salon: true } } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  return session;
});

const loadSession = cache(async () => {
  const session = await loadAnySession();
  return session?.verified ? session : null;
});

/** A signed-in session still waiting for its 2FA code. */
export async function getPendingSession() {
  const session = await loadAnySession();
  return session && !session.verified ? session : null;
}

/** Marks the pending session verified when the code is right. */
export async function completeSecondFactor(code: string): Promise<LoginResult> {
  const session = await getPendingSession();
  if (!session) return { ok: false, error: "Your sign-in expired. Start again." };
  const ip = await clientIp();
  const identifier = `2fa:${session.userId}`;
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const failures = await prisma.loginAttempt.count({ where: { identifier, success: false, createdAt: { gte: since } } });
  if (failures >= MAX_FAILED_LOGINS) {
    await destroySession();
    return { ok: false, error: "Too many wrong codes. Sign in again in 15 minutes." };
  }
  if (!session.user.totpSecret || !verifyTotp(session.user.totpSecret, code)) {
    await prisma.loginAttempt.create({ data: { identifier, ip, success: false } });
    return { ok: false, error: "Wrong code. Check the time on your phone and try again." };
  }
  await prisma.loginAttempt.create({ data: { identifier, ip, success: true } });
  await prisma.session.update({
    where: { id: session.id },
    data: { verified: true, expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000) },
  });
  await prisma.auditLog.create({
    data: { salonId: session.user.salonId, userId: session.userId, userName: session.user.name, action: "auth.login", ip, meta: { twoFactor: true } },
  });
  return { ok: true };
}

export type Ctx = NonNullable<Awaited<ReturnType<typeof getContext>>>;

/** Current user + salon + tenant-scoped db, or null when signed out. */
export const getContext = cache(async () => {
  const session = await loadSession();
  if (!session) return null;
  const { user } = session;
  return {
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
      mustChangePassword: user.mustChangePassword,
      twoFactorEnabled: user.twoFactorEnabled,
    },
    salon: user.salon,
    db: forSalon(user.salonId),
    isAdmin: user.role === "ADMIN",
  };
});

type RequireOpts = { role?: Role; allowPasswordChange?: boolean; allowReadOnly?: boolean };

/**
 * Use at the top of every page and server action. Redirects to /login when
 * signed out, to /change-password while a temporary password is in use, and
 * to / when the role isn't allowed.
 */
export async function requireUser(opts: RequireOpts = {}): Promise<Ctx> {
  const ctx = await getContext();
  if (!ctx) redirect("/login");
  if (ctx.user.mustChangePassword && !opts.allowPasswordChange) redirect("/change-password");
  if (opts.role === "ADMIN" && !ctx.isAdmin) redirect("/?denied=1");
  // Server Actions carry a Next-Action header: block every write while the
  // salon's subscription is read-only.
  if (!opts.allowReadOnly && subscriptionState(ctx.salon).readOnly && (await headers()).has("next-action")) {
    redirect("/read-only");
  }
  return ctx;
}

export const requireAdmin = () => requireUser({ role: "ADMIN" });

export function isPlatformAdmin(ctx: Ctx): boolean {
  const phones = (process.env.PLATFORM_ADMIN_PHONES ?? "").split(",").map((p) => normalizePhone(p)).filter(Boolean);
  // only admins of the owner's own (INTERNAL) workspace, never a client salon
  return ctx.isAdmin && ctx.salon.plan === "INTERNAL" && phones.includes(ctx.user.phone);
}

export async function requirePlatformAdmin(): Promise<Ctx> {
  const ctx = await requireUser({ allowReadOnly: true });
  if (!isPlatformAdmin(ctx)) redirect("/?denied=1");
  return ctx;
}

export function canViewDashboard(ctx: Ctx): boolean {
  return ctx.isAdmin || ctx.salon.subAdminCanViewDashboard;
}

// ---------- login ----------

export type LoginResult = { ok: true; needsCode?: boolean } | { ok: false; error: string };

export async function attemptLogin(identifier: string, password: string): Promise<LoginResult> {
  const ip = await clientIp();
  const generic = { ok: false as const, error: "Wrong phone/email or password." };

  const since = new Date(Date.now() - 15 * 60 * 1000);
  const recentFromIp = await prisma.loginAttempt.count({
    where: { ip, success: false, createdAt: { gte: since } },
  });
  if (recentFromIp >= IP_ATTEMPTS_PER_15_MIN) {
    return { ok: false, error: "Too many attempts. Try again in 15 minutes." };
  }

  const phone = normalizePhone(identifier);
  const email = identifier.includes("@") ? identifier.trim().toLowerCase() : null;
  const user = phone
    ? await prisma.user.findUnique({ where: { phone } })
    : email
      ? await prisma.user.findUnique({ where: { email } })
      : null;

  const record = (success: boolean) =>
    prisma.loginAttempt.create({ data: { identifier: identifier.slice(0, 100), ip, success } });

  if (!user || !user.active) {
    await verifyPassword(password, await getDummyHash());
    await record(false);
    return generic;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await record(false);
    return { ok: false, error: "Account locked after too many attempts. Try again later." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const failed = user.failedLogins + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins: failed >= MAX_FAILED_LOGINS ? 0 : failed,
        lockedUntil:
          failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null,
      },
    });
    await record(false);
    if (failed >= MAX_FAILED_LOGINS) {
      await prisma.auditLog.create({
        data: { salonId: user.salonId, userId: user.id, userName: user.name, action: "auth.locked", ip },
      });
    }
    return generic;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await record(true);
  if (user.twoFactorEnabled && user.totpSecret) {
    await createSession(user.id, false);
    return { ok: true, needsCode: true };
  }
  await prisma.auditLog.create({
    data: { salonId: user.salonId, userId: user.id, userName: user.name, action: "auth.login", ip },
  });
  await createSession(user.id);
  return { ok: true };
}
