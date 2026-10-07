import { describe, expect, it } from "vitest";
import { attentionItems, credentialsAvailable, inProgress, needsPayment, orderTimeline, orderTracker, serviceState } from "./derive";

const NOW = Date.UTC(2026, 9, 4, 12);
const day = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

describe("serviceState", () => {
  it("counts days left and flags the last week", () => {
    expect(serviceState({ status: "active", expires_at: iso(NOW + 21 * day) }, NOW)).toEqual({
      status: "active",
      daysLeft: 21,
      expiringSoon: false,
    });
    expect(serviceState({ status: "active", expires_at: iso(NOW + 7 * day) }, NOW).expiringSoon).toBe(true);
    expect(serviceState({ status: "active", expires_at: iso(NOW + 8 * day) }, NOW).expiringSoon).toBe(false);
  });

  it("treats a lapsed active service as expired before the nightly job runs", () => {
    const s = serviceState({ status: "active", expires_at: iso(NOW - 3600_000) }, NOW);
    expect(s.status).toBe("expired");
    expect(s.daysLeft).toBe(0);
    expect(s.expiringSoon).toBe(false);
  });

  it("leaves suspended and terminated services alone", () => {
    expect(serviceState({ status: "suspended", expires_at: iso(NOW + 5 * day) }, NOW).status).toBe("suspended");
    expect(serviceState({ status: "terminated", expires_at: iso(NOW - 5 * day) }, NOW).status).toBe("terminated");
  });

  it("only offers credentials while genuinely active", () => {
    expect(credentialsAvailable({ status: "active", expires_at: iso(NOW + day) }, NOW)).toBe(true);
    expect(credentialsAvailable({ status: "active", expires_at: iso(NOW - day) }, NOW)).toBe(false);
    expect(credentialsAvailable({ status: "suspended", expires_at: iso(NOW + day) }, NOW)).toBe(false);
  });
});

describe("order status groups", () => {
  it("knows when payment is still needed", () => {
    expect(needsPayment("awaiting_payment")).toBe(true);
    expect(needsPayment("rejected")).toBe(true);
    expect(needsPayment("under_review")).toBe(false);
  });
  it("knows what is still in progress", () => {
    for (const s of ["awaiting_payment", "under_review", "approved", "provisioning"] as const) expect(inProgress(s)).toBe(true);
    for (const s of ["completed", "rejected", "cancelled", "refunded"] as const) expect(inProgress(s)).toBe(false);
  });
});

describe("orderTimeline", () => {
  const order = (status: Parameters<typeof orderTimeline>[0]["status"]) => ({
    status,
    created_at: "2026-10-01T10:00:00Z",
    cancelled_at: status === "cancelled" ? "2026-10-02T10:00:00Z" : null,
  });

  it("shows later steps as pending for a fresh order", () => {
    const steps = orderTimeline(order("awaiting_payment"), [{ id: 1, event: "created", to_status: "awaiting_payment", created_at: "2026-10-01T10:00:01Z" }]);
    expect(steps.map((s) => [s.id, s.tone])).toEqual([
      ["placed", "default"],
      ["submitted", "pending"],
      ["verified", "pending"],
      ["delivered", "pending"],
    ]);
  });

  it("walks through to delivered", () => {
    const events = [
      { id: 1, event: "created", to_status: "awaiting_payment", created_at: "2026-10-01T10:00:00Z" },
      { id: 2, event: "payment_submitted", to_status: "under_review", created_at: "2026-10-01T11:00:00Z" },
      { id: 3, event: "approved", to_status: "approved", created_at: "2026-10-01T12:00:00Z" },
      { id: 4, event: "delivered", to_status: "completed", created_at: "2026-10-01T13:00:00Z" },
    ] as const;
    const steps = orderTimeline(order("completed"), [...events]);
    expect(steps.map((s) => s.at)).toEqual([
      "2026-10-01T10:00:00Z",
      "2026-10-01T11:00:00Z",
      "2026-10-01T12:00:00Z",
      "2026-10-01T13:00:00Z",
    ]);
    expect(steps.at(-1)?.tone).toBe("ok");
  });

  it("ends on the reason when payment is rejected, and on cancellation", () => {
    const rejected = orderTimeline(order("rejected"), [], "Amount didn't match.");
    expect(rejected.at(-1)).toMatchObject({ id: "rejected", tone: "bad", detail: "Amount didn't match." });
    const cancelled = orderTimeline(order("cancelled"), []);
    expect(cancelled.at(-1)).toMatchObject({ id: "cancelled", at: "2026-10-02T10:00:00Z" });
    expect(cancelled.map((s) => s.id)).not.toContain("delivered");
  });
});

describe("orderTracker", () => {
  type Status = Parameters<typeof orderTracker>[0]["status"];
  const order = (status: Status, type: "new" | "renewal" = "new") => ({
    status,
    type,
    created_at: "2026-10-01T10:00:00Z",
    cancelled_at: status === "cancelled" ? "2026-10-02T10:00:00Z" : null,
  });
  const ev = (id: number, event: string, to_status: Status | null, created_at: string) => ({ id, event, to_status, created_at });
  const created = ev(1, "created", "awaiting_payment", "2026-10-01T10:00:01Z");
  const submitted = ev(2, "payment_submitted", "under_review", "2026-10-01T11:00:00Z");
  const approved = ev(3, "payment_approved", "approved", "2026-10-01T12:00:00Z");
  const started = ev(4, "provisioning_started", "provisioning", "2026-10-01T12:30:00Z");
  const delivered = ev(5, "service_delivered", "completed", "2026-10-01T13:00:00Z");
  const states = (steps: ReturnType<typeof orderTracker>) => steps.map((s) => `${s.id}:${s.state}`);

  it("waits on payment for a fresh order", () => {
    const steps = orderTracker(order("awaiting_payment"), [created]);
    expect(states(steps)).toEqual(["placed:done", "payment:current", "verified:todo", "setup:todo", "delivered:todo"]);
    expect(steps[1]?.hint).toBe("Waiting for payment");
  });

  it("moves the current step along as the order progresses", () => {
    expect(states(orderTracker(order("under_review"), [created, submitted]))).toEqual(["placed:done", "payment:done", "verified:current", "setup:todo", "delivered:todo"]);
    expect(states(orderTracker(order("approved"), [created, submitted, approved]))).toEqual(["placed:done", "payment:done", "verified:done", "setup:current", "delivered:todo"]);
    expect(states(orderTracker(order("provisioning"), [created, submitted, approved, started]))).toEqual(["placed:done", "payment:done", "verified:done", "setup:current", "delivered:todo"]);
  });

  it("carries the dates from the event log and finishes on delivery", () => {
    const steps = orderTracker(order("completed"), [created, submitted, approved, started, delivered]);
    expect(states(steps)).toEqual(["placed:done", "payment:done", "verified:done", "setup:done", "delivered:done"]);
    expect(steps.map((s) => s.at)).toEqual([
      "2026-10-01T10:00:01Z",
      "2026-10-01T11:00:00Z",
      "2026-10-01T12:00:00Z",
      "2026-10-01T12:30:00Z",
      "2026-10-01T13:00:00Z",
    ]);
  });

  it("only says Pending for steps still ahead (a delivered order that skipped the setup event is simply done)", () => {
    const steps = orderTracker(order("completed"), [created, submitted, approved, delivered]);
    expect(steps.find((s) => s.id === "setup")).toMatchObject({ state: "done", at: null, hint: "" });
    expect(steps.find((s) => s.id === "verified")?.hint).toBe("");
    expect(orderTracker(order("approved"), [created, submitted, approved]).find((s) => s.id === "setup")?.hint).toBe("In progress");
    expect(orderTracker(order("awaiting_payment"), [created]).find((s) => s.id === "setup")?.hint).toBe("Pending");
  });

  it("a renewal has no setup step and ends on Renewed", () => {
    const steps = orderTracker(order("completed", "renewal"), [created, submitted, ev(3, "payment_approved", "completed", "2026-10-01T12:00:00Z")]);
    expect(states(steps)).toEqual(["placed:done", "payment:done", "verified:done", "renewed:done"]);
  });

  it("shows a rejected payment in red with the steps still ahead", () => {
    const steps = orderTracker(order("rejected"), [created, submitted, ev(3, "payment_rejected", "rejected", "2026-10-01T12:00:00Z")]);
    expect(states(steps)).toEqual(["placed:done", "rejected:bad", "verified:todo", "setup:todo", "delivered:todo"]);
    expect(steps[1]).toMatchObject({ at: "2026-10-01T12:00:00Z", hint: "Submit new proof" });
  });

  it("ends on Cancelled, and only counts payment if one was submitted", () => {
    expect(states(orderTracker(order("cancelled"), [created]))).toEqual(["placed:done", "payment:todo", "cancelled:bad"]);
    expect(states(orderTracker(order("cancelled"), [created, submitted]))).toEqual(["placed:done", "payment:done", "cancelled:bad"]);
    expect(orderTracker(order("cancelled"), [created]).at(-1)?.at).toBe("2026-10-02T10:00:00Z");
  });

  it("adds a Refunded step; setup and delivery only count if they really happened", () => {
    const refunded = ev(6, "refunded", "refunded", "2026-10-03T10:00:00Z");
    expect(states(orderTracker(order("refunded"), [created, submitted, approved, refunded]))).toEqual(["placed:done", "payment:done", "verified:done", "setup:todo", "delivered:todo", "refunded:bad"]);
    expect(states(orderTracker(order("refunded"), [created, submitted, approved, started, delivered, refunded]))).toEqual(["placed:done", "payment:done", "verified:done", "setup:done", "delivered:done", "refunded:bad"]);
  });
});

describe("attentionItems", () => {
  it("lists what needs doing, payments first", () => {
    const items = attentionItems(
      {
        orders: [
          { id: "o1", order_number: "CRV-001001", status: "awaiting_payment", expires_at: iso(NOW + day) },
          { id: "o2", order_number: "CRV-001002", status: "under_review", expires_at: iso(NOW + day) },
          { id: "o3", order_number: "CRV-001003", status: "rejected", expires_at: iso(NOW + day) },
          { id: "o4", order_number: "CRV-001004", status: "awaiting_payment", expires_at: iso(NOW - day) },
        ],
        services: [
          { id: "s1", label: "Trading-1", status: "active", expires_at: iso(NOW + 3 * day) },
          { id: "s2", label: "Fine", status: "active", expires_at: iso(NOW + 20 * day) },
          { id: "s3", label: "Old", status: "active", expires_at: iso(NOW - day) },
        ],
        tickets: [
          { id: "t1", ticket_no: 48, status: "awaiting_customer" },
          { id: "t2", ticket_no: 49, status: "open" },
        ],
      },
      NOW,
    );
    expect(items.map((i) => i.id)).toEqual(["o-o1", "o-o3", "s-s3", "s-s1", "t-t1"]);
    expect(items.find((i) => i.id === "s-s1")?.text).toBe("Renew “Trading-1” — expires in 3 days");
    expect(items.find((i) => i.id === "o-o1")?.href).toBe("/dashboard/orders/o1/pay");
    expect(items.find((i) => i.id === "s-s3")?.href).toBe("/order/new?renew=s3");
  });

  it("is empty when nothing needs attention", () => {
    expect(attentionItems({ orders: [], services: [], tickets: [] }, NOW)).toEqual([]);
  });
});
