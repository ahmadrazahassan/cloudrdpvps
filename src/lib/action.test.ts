import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const drain = vi.hoisted(() => ({ soon: vi.fn() }));

const state = vi.hoisted(() => ({
  user: null as null | { id: string; profile: { role: "customer" | "support" | "admin" } },
  captchaOk: true,
  configured: true,
  mfaRequired: false,
  needs2fa: false,
}));

vi.mock("@/lib/env", () => ({
  get isSupabaseConfigured() {
    return state.configured;
  },
}));

vi.mock("next/navigation", () => ({
  // Mirror Next: control-flow errors (redirect/notFound) carry a NEXT_* digest and must propagate.
  unstable_rethrow(e: unknown) {
    if (e && typeof e === "object" && String((e as { digest?: string }).digest ?? "").startsWith("NEXT_")) throw e;
  },
}));
vi.mock("@/lib/auth/session", () => ({
  getSessionUser: async () => state.user,
  isStaff: (u: { profile: { role: string } }) => u.profile.role === "support" || u.profile.role === "admin",
  isAdmin: (u: { profile: { role: string } }) => u.profile.role === "admin",
}));
vi.mock("@/lib/auth/mfa", () => ({
  getStaffAal: async () => ({ required: state.mfaRequired, enrolled: true, satisfied: !state.mfaRequired }),
  needsSecondFactor: async () => state.needs2fa,
}));
vi.mock("@/lib/request", () => ({ getClientIp: async () => "198.51.100.7" }));
vi.mock("@/lib/email/queue", () => ({ drainSoon: drain.soon }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ fake: "supabase" }) }));
vi.mock("@/lib/turnstile", () => ({
  TURNSTILE_FIELD: "cf-turnstile-response",
  verifyTurnstile: async () => state.captchaOk,
}));

import { action, formAction, formDataToObject } from "./action";
import { AppError } from "./errors";
import { resetMemoryLimiterForTests } from "./rate-limit";

const schema = z.object({ label: z.string().trim().min(2, "Too short") });
const customer = { id: "u1", profile: { role: "customer" as const } };

beforeEach(() => {
  drain.soon.mockClear();
  state.user = customer;
  state.captchaOk = true;
  state.configured = true;
  state.mfaRequired = false;
  state.needs2fa = false;
  resetMemoryLimiterForTests();
});

describe("action()", () => {
  it("runs the handler with parsed input and context, and wraps the result", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the 2nd parameter exists so the mock's call type includes the context
    const handler = vi.fn(async (input: { label: string }, _ctx: unknown) => ({ echoed: input.label }));
    const run = action({ name: "t1", schema, handler });
    const res = await run({ label: "  hello  " });
    expect(res).toEqual({ ok: true, data: { echoed: "hello" } });
    expect(handler.mock.calls[0]![1]).toMatchObject({ user: customer, ip: "198.51.100.7", supabase: { fake: "supabase" } });
  });

  it("returns field errors for invalid input and never calls the handler", async () => {
    const handler = vi.fn();
    const res = await action({ name: "t2", schema, handler })({ label: "x" });
    expect(res).toMatchObject({ ok: false, code: "VALIDATION", fieldErrors: { label: ["Too short"] } });
    expect(handler).not.toHaveBeenCalled();
  });

  it("requires sign-in unless the action is public", async () => {
    state.user = null;
    const handler = vi.fn(async () => "ok");
    expect(await action({ name: "t3", schema, handler })({ label: "abc" })).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(await action({ name: "t3p", schema, auth: "public", handler })({ label: "abc" })).toMatchObject({ ok: true });
  });

  it("enforces staff and admin levels", async () => {
    const handler = vi.fn(async () => "ok");
    const staff = action({ name: "t4s", schema, auth: "staff", handler });
    const admin = action({ name: "t4a", schema, auth: "admin", handler });
    expect(await staff({ label: "abc" })).toMatchObject({ code: "FORBIDDEN" });
    state.user = { id: "s1", profile: { role: "support" } };
    expect(await staff({ label: "abc" })).toMatchObject({ ok: true });
    expect(await admin({ label: "abc" })).toMatchObject({ code: "FORBIDDEN" });
    state.user = { id: "a1", profile: { role: "admin" } };
    expect(await admin({ label: "abc" })).toMatchObject({ ok: true });
    expect(handler).toHaveBeenCalledTimes(2); // the two FORBIDDEN calls never reached it
  });

  it("blocks staff and admin actions until the session has passed the second factor", async () => {
    state.mfaRequired = true;
    const handler = vi.fn(async () => "ok");
    state.user = { id: "a1", profile: { role: "admin" } };
    expect(await action({ name: "t4m", schema, auth: "admin", handler })({ label: "abc" })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    state.user = { id: "s1", profile: { role: "support" } };
    expect(await action({ name: "t4n", schema, auth: "staff", handler })({ label: "abc" })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(handler).not.toHaveBeenCalled();
    // customer-level and public actions are unaffected by the staff gate
    state.user = customer;
    expect(await action({ name: "t4o", schema, handler })({ label: "abc" })).toMatchObject({ ok: true });
  });

  it("blocks every signed-in action while an authenticator code is still owed, except password recovery", async () => {
    state.needs2fa = true;
    const handler = vi.fn(async () => "ok");
    expect(await action({ name: "t5a", schema, handler })({ label: "abc" })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(handler).not.toHaveBeenCalled();
    expect(await action({ name: "t5b", schema, mfa: "skip", handler })({ label: "abc" })).toMatchObject({ ok: true });
    expect(await action({ name: "t5c", schema, auth: "public", handler })({ label: "abc" })).toMatchObject({ ok: true });
    state.needs2fa = false;
    expect(await action({ name: "t5d", schema, handler })({ label: "abc" })).toMatchObject({ ok: true });
  });

  it("reports UNAVAILABLE (not a crash) when the backend isn't configured", async () => {
    state.configured = false;
    const handler = vi.fn(async () => "ok");
    expect(await action({ name: "t4u", schema, auth: "public", handler })({ label: "abc" })).toMatchObject({ ok: false, code: "UNAVAILABLE" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("carries field errors raised by the handler (e.g. from Supabase Auth)", async () => {
    const run = action({
      name: "t4f", schema,
      handler: async () => {
        throw new AppError("VALIDATION", undefined, { fieldErrors: { password: ["Too weak"] } });
      },
    });
    expect(await run({ label: "abc" })).toMatchObject({ ok: false, code: "VALIDATION", fieldErrors: { password: ["Too weak"] } });
  });

  it("maps AppErrors to their code and message", async () => {
    const run = action({
      name: "t5", schema,
      handler: async () => {
        throw new AppError("OUT_OF_STOCK");
      },
    });
    expect(await run({ label: "abc" })).toMatchObject({ ok: false, code: "OUT_OF_STOCK", message: expect.stringMatching(/out of stock/i) });
  });

  it("hides unexpected errors behind INTERNAL (no leak, but it is logged)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const run = action({
      name: "t6", schema,
      handler: async () => {
        throw new Error("connection to db.internal:5432 refused, password=hunter2");
      },
    });
    const res = await run({ label: "abc" });
    expect(res).toMatchObject({ ok: false, code: "INTERNAL" });
    expect(JSON.stringify(res)).not.toContain("hunter2");
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("lets redirect()/notFound() propagate instead of swallowing them", async () => {
    const run = action({
      name: "t7", schema,
      handler: async () => {
        throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/dashboard;307;" });
      },
    });
    await expect(run({ label: "abc" })).rejects.toThrow("NEXT_REDIRECT");
  });

  it("rate-limits per user", async () => {
    const run = action({ name: "t8", schema, rateLimit: { limit: 2, window: "1 m" }, handler: async () => "ok" });
    expect((await run({ label: "abc" })).ok).toBe(true);
    expect((await run({ label: "abc" })).ok).toBe(true);
    expect(await run({ label: "abc" })).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    state.user = { id: "someone-else", profile: { role: "customer" } };
    expect((await run({ label: "abc" })).ok).toBe(true); // separate bucket
  });

  it("checks the captcha before doing any work", async () => {
    const handler = vi.fn(async () => "ok");
    const run = action({ name: "t9", schema: schema.extend({ "cf-turnstile-response": z.string().optional() }), captcha: true, handler });
    state.captchaOk = false;
    expect(await run({ label: "abc", "cf-turnstile-response": "tok" })).toMatchObject({ code: "CAPTCHA_FAILED" });
    expect(handler).not.toHaveBeenCalled();
    state.captchaOk = true;
    expect((await run({ label: "abc", "cf-turnstile-response": "tok" })).ok).toBe(true);
  });
});

describe("notifies", () => {
  it("sends queued emails once the input is valid, even if the handler then fails", async () => {
    const run = action({
      name: "n1",
      schema,
      notifies: true,
      handler: async () => {
        throw new AppError("FORBIDDEN");
      },
    });
    expect(await run({ label: "x" })).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(drain.soon).not.toHaveBeenCalled(); // nothing was done, so nothing to send
    expect(await run({ label: "abc" })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(drain.soon).toHaveBeenCalledTimes(1); // registered before the handler, so a redirect() in it is covered too
  });

  it("does nothing for actions that don't cause an email", async () => {
    const run = action({ name: "n2", schema, handler: async () => "ok" });
    await run({ label: "abc" });
    expect(drain.soon).not.toHaveBeenCalled();
  });
});

describe("formAction()", () => {
  it("works as a useActionState reducer over FormData", async () => {
    const run = formAction({ name: "f1", schema, handler: async (i) => i.label.toUpperCase() });
    const fd = new FormData();
    fd.set("label", "abc");
    fd.set("$ACTION_ID_deadbeef", "");
    expect(await run(null, fd)).toEqual({ ok: true, data: "ABC" });
  });
});

describe("formDataToObject", () => {
  it("drops Next internals and groups name[] keys", () => {
    const fd = new FormData();
    fd.append("a", "1");
    fd.append("$ACTION_REF_1", "x");
    fd.append("tags[]", "x");
    fd.append("tags[]", "y");
    expect(formDataToObject(fd)).toEqual({ a: "1", tags: ["x", "y"] });
  });
});
