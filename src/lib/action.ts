import type { z } from "zod";

/** Return value of every form server action, rendered by <ActionForm>. */
export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  // one-time secrets (e.g. a temporary password) shown right after the action
  secret?: string;
  // changes on each success so forms can reset themselves
  key?: number;
};

export const ok = (message?: string, extra: Partial<ActionState> = {}): ActionState => ({
  ok: true,
  message,
  key: Date.now(),
  ...extra,
});

export const fail = (error: string): ActionState => ({ ok: false, error });

/** Parses FormData with a zod schema; returns the first error message on failure. */
export function parseForm<T extends z.ZodType>(
  schema: T,
  fd: FormData,
): { ok: true; data: z.infer<T> } | { ok: false; error: string } {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("$ACTION")) continue;
    raw[k] = typeof v === "string" ? v.trim() : v;
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.join(".");
    return { ok: false, error: field ? `${field}: ${issue.message}` : issue.message };
  }
  return { ok: true, data: result.data };
}
