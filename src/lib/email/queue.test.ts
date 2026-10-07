import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  configured: true,
  insertError: null as null | { message: string },
  existing: 0,
  inserted: [] as unknown[],
  afterCallbacks: [] as Array<() => Promise<void> | void>,
  afterThrows: false,
  drain: vi.fn(async () => ({ configured: true, sent: 1, failed: 0, retrying: 0 })),
}));

vi.mock("next/server", () => ({
  after(cb: () => Promise<void> | void) {
    if (h.afterThrows) throw new Error("`after` was called outside a request scope");
    h.afterCallbacks.push(cb);
  },
}));
vi.mock("./send", () => ({ emailConfigured: () => h.configured }));
vi.mock("./drain", () => ({ drainEmailOutbox: h.drain }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: async (row: unknown) => {
        if (!h.insertError) h.inserted.push(row);
        return { error: h.insertError };
      },
      select: () => ({ eq: () => ({ eq: async () => ({ count: h.existing, error: null }) }) }),
    }),
  }),
}));

import { drainSoon, enqueueEmail, queueWelcomeEmail } from "./queue";

beforeEach(() => {
  h.configured = true;
  h.insertError = null;
  h.existing = 0;
  h.inserted = [];
  h.afterCallbacks = [];
  h.afterThrows = false;
  h.drain.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("enqueueEmail", () => {
  it("queues a row for the recipient", async () => {
    expect(await enqueueEmail({ userId: "u1", to: "a@example.com", template: "password_changed" })).toBe(true);
    expect(h.inserted).toEqual([{ user_id: "u1", to_email: "a@example.com", template: "password_changed", data: {} }]);
  });

  it("reports failure instead of throwing, so email never breaks the action it belongs to", async () => {
    h.insertError = { message: "boom" };
    expect(await enqueueEmail({ userId: "u1", to: "a@example.com", template: "welcome" })).toBe(false);
  });
});

describe("queueWelcomeEmail", () => {
  it("queues one welcome with the customer's name", async () => {
    expect(await queueWelcomeEmail({ id: "u1", email: "a@example.com", name: "  Aisha Khan " })).toBe(true);
    expect(h.inserted).toEqual([{ user_id: "u1", to_email: "a@example.com", template: "welcome", data: { name: "Aisha Khan" } }]);
  });

  it("does nothing when the account already has a welcome (confirm links get clicked twice)", async () => {
    h.existing = 1;
    expect(await queueWelcomeEmail({ id: "u1", email: "a@example.com" })).toBe(false);
    expect(h.inserted).toEqual([]);
  });
});

describe("drainSoon", () => {
  it("sends what is queued after the response", async () => {
    drainSoon();
    expect(h.afterCallbacks).toHaveLength(1);
    expect(h.drain).not.toHaveBeenCalled(); // not before the response is done
    await h.afterCallbacks[0]!();
    expect(h.drain).toHaveBeenCalledTimes(1);
  });

  it("does nothing until Resend is configured (rows stay queued)", () => {
    h.configured = false;
    drainSoon();
    expect(h.afterCallbacks).toHaveLength(0);
  });

  it("never throws: outside a request the scheduled run picks the email up", () => {
    h.afterThrows = true;
    expect(() => drainSoon()).not.toThrow();
  });

  it("a failing drain is logged, not raised", async () => {
    h.drain.mockRejectedValueOnce(new Error("db down"));
    drainSoon();
    await expect(h.afterCallbacks[0]!()).resolves.toBeUndefined();
  });
});
