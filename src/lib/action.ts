import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getStaffAal, needsSecondFactor } from "@/lib/auth/mfa";
import { isAdmin, isStaff, getSessionUser, type SessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { AppError, ERROR_MESSAGES, type ErrorCode } from "@/lib/errors";
import { rateLimit, type Window } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";
import { TURNSTILE_FIELD, verifyTurnstile } from "@/lib/turnstile";

export type FieldErrors = Record<string, string[]>;

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; message: string; fieldErrors?: FieldErrors };

export interface ActionContext {
  /** Null only for `auth: "public"` actions called while signed out. */
  user: SessionUser | null;
  ip: string;
  /** Acts as the signed-in user (anon key + cookies) — everything runs under RLS. */
  supabase: ServerSupabase;
}

type AuthLevel = "public" | "user" | "staff" | "admin";

export interface ActionOptions<S extends z.ZodType, T> {
  /** Used in logs and as the rate-limit bucket name. */
  name: string;
  schema: S;
  /** Who may call it. Default "user". Roles are re-checked in the database too. */
  auth?: AuthLevel;
  /** Throttle per user (or per IP when signed out). */
  rateLimit?: { limit: number; window: Window };
  /** Require a Turnstile token in the form (`cf-turnstile-response`). */
  captcha?: boolean;
  /** "skip" lets a session that hasn't passed its second factor call this (only password recovery needs that). */
  mfa?: "skip";
  handler: (input: z.output<S>, ctx: ActionContext) => Promise<T>;
}

/** FormData -> plain object. Repeated `name[]` keys become arrays; Next's internal `$ACTION_*` fields are dropped. */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [rawKey, value] of formData.entries()) {
    if (rawKey.startsWith("$ACTION")) continue;
    if (rawKey.endsWith("[]")) {
      const key = rawKey.slice(0, -2);
      const list = (out[key] as unknown[] | undefined) ?? [];
      list.push(value);
      out[key] = list;
    } else {
      out[rawKey] = value;
    }
  }
  return out;
}

const fail = (code: ErrorCode, extra: { message?: string; fieldErrors?: FieldErrors } = {}): ActionResult<never> => ({
  ok: false,
  code,
  message: extra.message ?? ERROR_MESSAGES[code],
  ...(extra.fieldErrors ? { fieldErrors: extra.fieldErrors } : {}),
});

function createRunner<S extends z.ZodType, T>(opts: ActionOptions<S, T>) {
  const level: AuthLevel = opts.auth ?? "user";

  return async function run(raw: unknown): Promise<ActionResult<T>> {
    try {
      if (!isSupabaseConfigured) return fail("UNAVAILABLE");
      const [ip, user] = await Promise.all([getClientIp(), getSessionUser()]);

      if (level !== "public" && !user) return fail("UNAUTHENTICATED");
      if (level === "staff" && user && !isStaff(user)) return fail("FORBIDDEN");
      if (level === "admin" && user && !isAdmin(user)) return fail("FORBIDDEN");
      // Someone with an authenticator who hasn't entered a code in this session can't act, even by calling an
      // action directly (an action is a plain POST). Password recovery opts out: the email link is the proof there.
      if (level !== "public" && user && opts.mfa !== "skip" && (await needsSecondFactor())) {
        return fail("FORBIDDEN", { message: "Confirm your authenticator code first, then try again." });
      }
      // Staff mutations need the second factor too, not just the console pages.
      if ((level === "staff" || level === "admin") && user && !(await getStaffAal()).satisfied) {
        return fail("FORBIDDEN", { message: "Confirm your authenticator code first, then try again." });
      }

      if (opts.rateLimit) {
        const rl = await rateLimit({ name: opts.name, id: user?.id ?? ip, ...opts.rateLimit });
        if (!rl.ok) return fail("RATE_LIMITED");
      }

      if (opts.captcha) {
        const token = raw && typeof raw === "object" ? (raw as Record<string, unknown>)[TURNSTILE_FIELD] : undefined;
        if (!(await verifyTurnstile(token, ip))) return fail("CAPTCHA_FAILED");
      }

      const parsed = opts.schema.safeParse(raw);
      if (!parsed.success) {
        return fail("VALIDATION", { fieldErrors: z.flattenError(parsed.error as z.ZodError).fieldErrors as FieldErrors });
      }

      const supabase = await createClient();
      const data = await opts.handler(parsed.data, { user, ip, supabase });
      return { ok: true, data };
    } catch (error) {
      // redirect(), notFound(), forbidden()… are thrown by Next on purpose.
      unstable_rethrow(error);
      if (error instanceof AppError) {
        if (error.code === "INTERNAL") console.error(`[action:${opts.name}]`, error.cause ?? error);
        return fail(error.code, { message: error.message, fieldErrors: error.fieldErrors });
      }
      console.error(`[action:${opts.name}] unexpected error`, error);
      return fail("INTERNAL");
    }
  };
}

/**
 * For <form action={...}> with `useActionState`:
 *   const [state, formAction, pending] = useActionState(login, null)
 */
export function formAction<S extends z.ZodType, T>(opts: ActionOptions<S, T>) {
  const run = createRunner(opts);
  return async (_previous: ActionResult<T> | null, formData: FormData): Promise<ActionResult<T>> =>
    run(formDataToObject(formData));
}

/** For direct calls from event handlers: `await renameService({ id, label })`. */
export function action<S extends z.ZodType, T>(opts: ActionOptions<S, T>) {
  const run = createRunner(opts);
  return async (input: z.input<S>): Promise<ActionResult<T>> => run(input);
}
