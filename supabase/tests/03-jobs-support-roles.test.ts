import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, createUser, expectError, type Db } from "./harness";
import {
  allocate, approve, asService, asUser, createOrder, deliverServer, makeWorld, submitPayment, type World,
} from "./flows";

const CIPHERTEXT = "v1.k1.iv.tag.ct"; // what flows.allocate stores as the encrypted password

describe("scheduled jobs", () => {
  let db: Db;
  let w: World;
  beforeAll(async () => {
    db = await createDb();
    w = await makeWorld(db);
  });
  afterAll(async () => {
    await db.close();
  });

  const run = async (fn: string) => (await asService(db, () => db.query<{ n: number }>(`select public.${fn}() as n`))).rows[0]!.n;
  const notes = async (uid: string, type: string) =>
    (await db.query<any>("select * from public.notifications where user_id = $1 and type = $2", [uid, type])).rows;

  it("jobs are callable by the service role only", async () => {
    for (const fn of ["cancel_stale_orders", "expire_services", "enqueue_expiry_reminders", "flag_terminate_due"]) {
      await asUser(db, w.admin, () => expectError(db.query(`select public.${fn}()`), /permission denied/));
      await asUser(db, w.alice, () => expectError(db.query(`select public.${fn}()`), /permission denied/));
      expect(await run(fn)).toBeGreaterThanOrEqual(0);
    }
  });

  it("cancel_stale_orders cancels only overdue unpaid orders, releases coupons, and is idempotent", async () => {
    await db.query("insert into public.coupons (code, type, value) values ('STALE10', 'percent', 10)");
    const stale = await createOrder(db, w.alice, { coupon: "STALE10" });
    const fresh = await createOrder(db, w.alice);
    const reviewing = await createOrder(db, w.bob);
    await submitPayment(db, w.bob, reviewing.id, w.methodId);
    const rejected = await createOrder(db, w.bob);
    const p = await submitPayment(db, w.bob, rejected.id, w.methodId);
    await asUser(db, w.admin, () => db.query("select * from public.reject_payment($1::uuid, 'blurry')", [p.id]));

    await db.query("update public.orders set expires_at = now() - interval '1 minute' where id = any($1::uuid[])", [[stale.id, reviewing.id, rejected.id]]);

    expect(await run("cancel_stale_orders")).toBe(2); // stale + rejected; the one under review is left for staff
    const st = async (id: string) => (await db.query<any>("select status from public.orders where id = $1", [id])).rows[0].status;
    expect(await st(stale.id)).toBe("cancelled");
    expect(await st(rejected.id)).toBe("cancelled");
    expect(await st(reviewing.id)).toBe("under_review");
    expect(await st(fresh.id)).toBe("awaiting_payment");

    expect((await db.query<any>("select redeemed_count from public.coupons where code = 'STALE10'")).rows[0].redeemed_count).toBe(0);
    expect((await notes(w.alice, "order_cancelled")).length).toBe(1);
    expect(await run("cancel_stale_orders")).toBe(0);
  });

  it("expire_services expires only overdue active services, tells the customer once, and never deletes", async () => {
    const a = await deliverServer(w, w.alice);
    const b = await deliverServer(w, w.bob);
    const c = await deliverServer(w, w.bob);
    await db.query("update public.services set expires_at = now() - interval '1 hour' where id = $1", [a.service.id]);
    await db.query("update public.services set expires_at = now() - interval '1 hour', status = 'suspended', suspended_reason = 'x' where id = $1", [c.service.id]);

    expect(await run("expire_services")).toBe(1);
    const status = async (id: string) => (await db.query<any>("select status from public.services where id = $1", [id])).rows[0].status;
    expect(await status(a.service.id)).toBe("expired");
    expect(await status(b.service.id)).toBe("active");
    expect(await status(c.service.id)).toBe("suspended");
    expect((await notes(w.alice, "service_expired")).length).toBe(1);
    expect((await db.query("select 1 from public.service_credentials where service_id = $1", [a.service.id])).rows).toHaveLength(1);
    expect(await run("expire_services")).toBe(0);

    // an expired service refuses to reveal credentials to its owner
    await asUser(db, w.alice, () => expectError(db.query("select * from public.get_service_credentials($1::uuid)", [a.service.id]), "SERVICE_NOT_ACTIVE"));
  });

  it("expiry reminders: one per threshold bucket, never duplicated, none for far-off services", async () => {
    const { service } = await deliverServer(w, w.alice);
    const n = async () => (await notes(w.alice, "expiring_soon")).filter((x) => x.data.service_id === service.id).length;
    await db.query("update public.services set expires_at = now() + interval '20 days' where id = $1", [service.id]);
    await run("enqueue_expiry_reminders");
    expect(await n()).toBe(0);

    await db.query("update public.services set expires_at = now() + interval '2 days 12 hours' where id = $1", [service.id]);
    await run("enqueue_expiry_reminders");
    await run("enqueue_expiry_reminders");
    expect(await n()).toBe(1);

    await db.query("update public.services set expires_at = now() + interval '20 hours' where id = $1", [service.id]);
    await run("enqueue_expiry_reminders");
    await run("enqueue_expiry_reminders");
    expect(await n()).toBe(2);

    const mails = (await db.query<any>("select data from public.email_outbox where user_id = $1 and template = 'expiring_soon'", [w.alice])).rows;
    expect(mails.length).toBeGreaterThanOrEqual(2);
    expect(mails.map((m) => m.data.days).sort()).toEqual(expect.arrayContaining([1, 3]));
  });

  it("flag_terminate_due tells each active admin once, only after the grace period", async () => {
    const { service } = await deliverServer(w, w.alice);
    await db.query("update public.services set status = 'expired', expires_at = now() - interval '1 day' where id = $1", [service.id]);
    const before = await run("flag_terminate_due"); // inside the 2-day grace: nothing for this service
    const flagged = async () => (await db.query<any>("select user_id from public.notifications where type = 'terminate_due' and data ->> 'service_id' = $1", [service.id])).rows;
    expect(await flagged()).toHaveLength(0);
    expect(before).toBeGreaterThanOrEqual(0);

    await db.query("update public.services set expires_at = now() - interval '5 days' where id = $1", [service.id]);
    expect(await run("flag_terminate_due")).toBeGreaterThanOrEqual(1);
    expect((await flagged()).map((r) => r.user_id)).toEqual([w.admin]);
    expect(await run("flag_terminate_due")).toBe(0);

    const admin2 = await createUser(db, { role: "admin" });
    expect(await run("flag_terminate_due")).toBe(1); // only the new admin
    expect((await flagged()).map((r) => r.user_id).sort()).toEqual([w.admin, admin2].sort());
  });
});

describe("support tickets", () => {
  let db: Db;
  let w: World;
  beforeAll(async () => {
    db = await createDb();
    w = await makeWorld(db);
  });
  afterAll(async () => {
    await db.close();
  });

  const open = (uid: string, subject = "Cannot connect", service: string | null = null) =>
    asUser(db, uid, async () =>
      (await db.query<any>("select * from public.create_ticket($1,'cannot_connect'::public.ticket_category,$2::uuid,$3)", [subject, service, "RDP times out"])).rows[0]!,
    );
  const staffReply = (uid: string, ticket: string, body: string, internal = false) =>
    asUser(db, uid, async () => (await db.query<any>("select * from public.staff_reply_to_ticket($1::uuid,$2,$3)", [ticket, body, internal])).rows[0]!);
  const status = async (id: string) => (await db.query<any>("select * from public.tickets where id = $1", [id])).rows[0];

  it("creates a ticket with its first message; only the owner (and staff) can see it", async () => {
    const t = await open(w.alice);
    expect(t.status).toBe("open");
    expect(Number(t.ticket_no)).toBeGreaterThan(0);
    const msgs = (await db.query<any>("select author_role, body from public.ticket_messages where ticket_id = $1", [t.id])).rows;
    expect(msgs).toEqual([{ author_role: "customer", body: "RDP times out" }]);

    await asUser(db, w.alice, async () => expect((await db.query("select 1 from public.tickets")).rows).toHaveLength(1));
    await asUser(db, w.bob, async () => {
      expect((await db.query("select 1 from public.tickets")).rows).toHaveLength(0);
      expect((await db.query("select 1 from public.ticket_messages")).rows).toHaveLength(0);
    });
    await asUser(db, w.support, async () => expect((await db.query("select 1 from public.tickets")).rows.length).toBeGreaterThan(0));
  });

  it("a ticket can only reference the customer's own service", async () => {
    const { service } = await deliverServer(w, w.bob);
    await expectError(open(w.alice, "Not mine", service.id), "NOT_FOUND");
    const own = await open(w.bob, "My server", service.id);
    expect(own.service_id).toBe(service.id);
  });

  it("validates subject and message", async () => {
    await expectError(open(w.alice, "ab"), /check|violat|subject/i);
    await asUser(db, w.alice, () =>
      expectError(db.query("select * from public.create_ticket('Valid subject','other'::public.ticket_category,null,'')"), /check|violat|body/i),
    );
  });

  it("staff replies are visible to the customer, flip the status, notify and queue an email; internal notes are invisible", async () => {
    const t = await open(w.alice);
    await staffReply(w.support, t.id, "Please try port 3390");
    await staffReply(w.support, t.id, "INTERNAL: suspect abuse on this IP", true);
    expect((await status(t.id)).status).toBe("awaiting_customer");

    const seen = await asUser(db, w.alice, async () => (await db.query<any>("select body, author_role from public.ticket_messages where ticket_id = $1 order by created_at", [t.id])).rows);
    expect(seen.map((m) => m.body)).toEqual(["RDP times out", "Please try port 3390"]);
    expect(JSON.stringify(seen)).not.toContain("INTERNAL");

    const staffSees = await asUser(db, w.support, async () => (await db.query("select 1 from public.ticket_messages where ticket_id = $1", [t.id])).rows);
    expect(staffSees).toHaveLength(3);

    const n = (await db.query<any>("select 1 from public.notifications where user_id = $1 and type = 'ticket_reply'", [w.alice])).rows;
    expect(n).toHaveLength(1); // the internal note did not notify
    const mails = (await db.query<any>("select 1 from public.email_outbox where user_id = $1 and template = 'ticket_reply'", [w.alice])).rows;
    expect(mails).toHaveLength(1);

    const after = await status(t.id);
    expect(after.last_staff_message_at).not.toBeNull();
  });

  it("customers cannot use staff functions or write ticket tables directly", async () => {
    const t = await open(w.alice);
    await expectError(staffReply(w.alice, t.id, "I am staff now"), "FORBIDDEN");
    await asUser(db, w.alice, () => expectError(db.query("select * from public.assign_ticket($1::uuid, $2::uuid)", [t.id, w.alice]), "FORBIDDEN"));
    await asUser(db, w.alice, () => expectError(db.query("select * from public.set_ticket_fields($1::uuid,'closed')", [t.id]), "FORBIDDEN"));
    await asUser(db, w.alice, () => expectError(db.query("insert into public.ticket_messages (ticket_id, author_role, body) values ($1,'support','x')", [t.id]), /permission denied/));
    await asUser(db, w.alice, () => expectError(db.query("update public.tickets set status = 'closed' where id = $1", [t.id]), /permission denied/));
  });

  it("customer reply re-opens; customer may only mark resolved/open; ownership enforced", async () => {
    const t = await open(w.alice);
    await staffReply(w.support, t.id, "Fixed?");
    await asUser(db, w.alice, () => db.query("select * from public.reply_to_ticket($1::uuid, 'Still broken')", [t.id]));
    expect((await status(t.id)).status).toBe("open");

    const r = await asUser(db, w.alice, async () => (await db.query<any>("select * from public.set_ticket_status_customer($1::uuid,'resolved')", [t.id])).rows[0]);
    expect(r.status).toBe("resolved");
    expect(r.resolved_at).not.toBeNull();
    await asUser(db, w.alice, () => expectError(db.query("select * from public.set_ticket_status_customer($1::uuid,'closed')", [t.id]), "FORBIDDEN"));
    await asUser(db, w.bob, () => expectError(db.query("select * from public.reply_to_ticket($1::uuid,'hijack')", [t.id]), "NOT_FOUND"));
    await asUser(db, w.bob, () => expectError(db.query("select * from public.set_ticket_status_customer($1::uuid,'resolved')", [t.id]), "NOT_FOUND"));
  });

  it("a ticket closed more than 7 days ago can't be revived; a recently closed one can", async () => {
    const recent = await open(w.alice, "Recent close");
    await asUser(db, w.admin, () => db.query("select * from public.set_ticket_fields($1::uuid,'closed')", [recent.id]));
    expect((await status(recent.id)).closed_at).not.toBeNull();
    await asUser(db, w.alice, () => db.query("select * from public.reply_to_ticket($1::uuid, 'one more thing')", [recent.id]));
    expect((await status(recent.id))).toMatchObject({ status: "open", closed_at: null });

    const old = await open(w.alice, "Old close");
    await asUser(db, w.admin, () => db.query("select * from public.set_ticket_fields($1::uuid,'closed')", [old.id]));
    await db.query("update public.tickets set closed_at = now() - interval '8 days' where id = $1", [old.id]);
    await asUser(db, w.alice, () => expectError(db.query("select * from public.reply_to_ticket($1::uuid, 'revive')", [old.id]), "TICKET_CLOSED"));
    await asUser(db, w.alice, () => expectError(db.query("select * from public.set_ticket_status_customer($1::uuid,'open')", [old.id]), "TICKET_CLOSED"));
  });

  it("staff can assign (to staff only), prioritise and recategorise", async () => {
    const t = await open(w.alice);
    const a = await asUser(db, w.support, async () => (await db.query<any>("select * from public.assign_ticket($1::uuid,$2::uuid)", [t.id, w.support])).rows[0]);
    expect(a.assigned_to).toBe(w.support);
    await asUser(db, w.support, () => expectError(db.query("select * from public.assign_ticket($1::uuid,$2::uuid)", [t.id, w.bob]), "VALIDATION"));
    const f = await asUser(db, w.support, async () =>
      (await db.query<any>("select * from public.set_ticket_fields($1::uuid, null, 'urgent'::public.ticket_priority, 'billing'::public.ticket_category)", [t.id])).rows[0]);
    expect(f).toMatchObject({ priority: "urgent", category: "billing", status: "open" });
    await asUser(db, w.support, () => expectError(db.query("select * from public.assign_ticket($1::uuid,null)", [crypto.randomUUID()]), "NOT_FOUND"));
  });

  it("a suspended customer can't open or answer tickets", async () => {
    const t = await open(w.alice);
    const u = await createUser(db);
    await asUser(db, w.admin, () => db.query("select * from public.set_account_status($1::uuid,'suspended','abuse')", [u]));
    await expectError(open(u), "ACCOUNT_SUSPENDED");
    await db.query("update public.tickets set user_id = $1 where id = $2", [u, t.id]);
    await asUser(db, u, () => expectError(db.query("select * from public.reply_to_ticket($1::uuid,'hi')", [t.id]), "ACCOUNT_SUSPENDED"));
  });
});

describe("roles, accounts and credentials", () => {
  let db: Db;
  let w: World;
  beforeAll(async () => {
    db = await createDb();
    w = await makeWorld(db);
  });
  afterAll(async () => {
    await db.close();
  });

  it("only admins change roles, never their own, and the change is audited", async () => {
    await asUser(db, w.support, () => expectError(db.query("select * from public.set_user_role($1::uuid,'admin')", [w.bob]), "FORBIDDEN"));
    await asUser(db, w.alice, () => expectError(db.query("select * from public.set_user_role($1::uuid,'admin')", [w.alice]), "FORBIDDEN"));
    await asUser(db, w.admin, () => expectError(db.query("select * from public.set_user_role($1::uuid,'customer')", [w.admin]), "FORBIDDEN"));

    const p = await asUser(db, w.admin, async () => (await db.query<any>("select * from public.set_user_role($1::uuid,'support')", [w.bob])).rows[0]);
    expect(p.role).toBe("support");
    const log = (await db.query<any>("select actor_id, before, after from public.audit_logs where action = 'user.set_role' and entity_id = $1", [w.bob])).rows;
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ actor_id: w.admin, before: { role: "customer" }, after: { role: "support" } });

    // the new support agent can now work tickets, but still can't touch money
    await asUser(db, w.bob, async () => expect((await db.query<any>("select public.admin_action_queue() as q")).rows[0].q).toBeTruthy());
    await asUser(db, w.bob, () => expectError(db.query("select * from public.set_user_role($1::uuid,'admin')", [w.bob]), "FORBIDDEN"));
    await asUser(db, w.admin, () => db.query("select * from public.set_user_role($1::uuid,'customer')", [w.bob]));
  });

  it("suspending needs a reason, locks the customer out of ordering, and reactivating restores access", async () => {
    const u = await createUser(db);
    await asUser(db, w.admin, () => expectError(db.query("select * from public.set_account_status($1::uuid,'suspended','')", [u]), "REASON_REQUIRED"));
    await asUser(db, w.admin, () => expectError(db.query("select * from public.set_account_status($1::uuid,'suspended','x')", [w.admin]), "FORBIDDEN"));
    await asUser(db, w.support, () => expectError(db.query("select * from public.set_account_status($1::uuid,'suspended','x')", [u]), "FORBIDDEN"));

    const s = await asUser(db, w.admin, async () => (await db.query<any>("select * from public.set_account_status($1::uuid,'suspended','chargeback')", [u])).rows[0]);
    expect(s).toMatchObject({ status: "suspended", suspended_reason: "chargeback" });
    await expectError(createOrder(db, u), "ACCOUNT_SUSPENDED");
    const mail = (await db.query<any>("select data from public.email_outbox where user_id = $1 and template = 'account_suspended'", [u])).rows;
    expect(mail).toHaveLength(1);
    expect(mail[0].data).toEqual({ reason: "chargeback" });

    const r = await asUser(db, w.admin, async () => (await db.query<any>("select * from public.set_account_status($1::uuid,'active')", [u])).rows[0]);
    expect(r).toMatchObject({ status: "active", suspended_reason: null });
    expect((await createOrder(db, u)).status).toBe("awaiting_payment");
  });

  it("owner can read credentials of an active service; others cannot; admin reads are audited", async () => {
    const { service } = await deliverServer(w, w.alice);
    const own = await asUser(db, w.alice, async () => (await db.query<any>("select * from public.get_service_credentials($1::uuid)", [service.id])).rows);
    expect(own).toEqual([{ username: "Administrator", password_enc: CIPHERTEXT }]);
    await asUser(db, w.bob, () => expectError(db.query("select * from public.get_service_credentials($1::uuid)", [service.id]), "FORBIDDEN"));
    await asUser(db, w.support, () => expectError(db.query("select * from public.get_service_credentials($1::uuid)", [service.id]), "FORBIDDEN"));
    await asUser(db, w.admin, () => db.query("select * from public.get_service_credentials($1::uuid)", [service.id]));
    const actions = (await db.query<any>("select action, actor_id from public.audit_logs where entity_id = $1 and action like 'credentials.reveal%' order by id", [service.id])).rows;
    expect(actions).toEqual([
      { action: "credentials.reveal", actor_id: w.alice },
      { action: "credentials.reveal.admin", actor_id: w.admin },
    ]);
  });

  it("admins rotate credentials: validated, audited without the secret, optional notification", async () => {
    const { service } = await deliverServer(w, w.alice);
    const rotate = (username: string, enc: string, notify = false) =>
      asUser(db, w.admin, () => db.query("select public.update_service_credentials($1::uuid,$2,$3,$4)", [service.id, username, enc, notify]));
    await expectError(rotate(" ", "v1.k1.a.b.c"), "VALIDATION");
    await expectError(rotate("Administrator", ""), "VALIDATION");
    await asUser(db, w.support, () => expectError(db.query("select public.update_service_credentials($1::uuid,'x','y')", [service.id]), "FORBIDDEN"));

    await rotate("Administrator", "v1.k2.NEW.SECRET.BLOB", true);
    const got = await asUser(db, w.alice, async () => (await db.query<any>("select * from public.get_service_credentials($1::uuid)", [service.id])).rows[0]);
    expect(got.password_enc).toBe("v1.k2.NEW.SECRET.BLOB");
    expect((await db.query<any>("select 1 from public.notifications where user_id = $1 and type = 'credentials_updated'", [w.alice])).rows).toHaveLength(1);
    expect((await db.query<any>("select 1 from public.audit_logs where action = 'service.credentials_update' and entity_id = $1", [service.id])).rows).toHaveLength(1);
  });

  it("no secret ever lands in the audit log, notifications, outbox or order events", async () => {
    const dump = async (table: string) => (await db.query<{ t: string }>(`select coalesce(string_agg(x::text, ' '), '') as t from public.${table} x`)).rows[0]!.t;
    for (const table of ["audit_logs", "notifications", "email_outbox", "order_events"]) {
      const text = await dump(table);
      expect(text, table).not.toContain(CIPHERTEXT);
      expect(text, table).not.toContain("NEW.SECRET.BLOB");
      expect(text, table).not.toMatch(/password_enc/);
    }
  });

  it("direct admin edits of the catalog are audited with before/after; customers see no audit rows", async () => {
    const pp = (await db.query<any>("select plan_id, location_id, price_cents from public.plan_pricing limit 1")).rows[0];
    await asUser(db, w.admin, () =>
      db.query("update public.plan_pricing set price_cents = price_cents + 100 where plan_id = $1 and location_id = $2", [pp.plan_id, pp.location_id]),
    );
    const log = (await db.query<any>("select actor_id, before, after from public.audit_logs where action = 'plan_pricing.update'")).rows;
    expect(log).toHaveLength(1);
    expect(log[0].actor_id).toBe(w.admin);
    expect(log[0].before.price_cents).toBe(pp.price_cents);
    expect(log[0].after.price_cents).toBe(pp.price_cents + 100);

    await asUser(db, w.alice, async () => expect((await db.query("select * from public.audit_logs")).rows).toHaveLength(0));
    await asUser(db, w.support, async () => expect((await db.query("select * from public.audit_logs")).rows).toHaveLength(0));
    await asUser(db, w.admin, async () => expect((await db.query("select * from public.audit_logs")).rows.length).toBeGreaterThan(0));
  });
});

describe("admin dashboards", () => {
  let db: Db;
  let w: World;
  beforeAll(async () => {
    db = await createDb();
    w = await makeWorld(db);
  });
  afterAll(async () => {
    await db.close();
  });

  const queue = (uid: string) => asUser(db, uid, async () => (await db.query<any>("select public.admin_action_queue() as q")).rows[0].q);

  it("the action queue counts what staff must do, and is hidden from customers", async () => {
    expect(await queue(w.support)).toMatchObject({ payments_to_review: 0, orders_to_allocate: 0, tickets_awaiting_staff: 0, unread_inbox: 0 });
    await asUser(db, w.alice, () => expectError(db.query("select public.admin_action_queue()"), "FORBIDDEN"));

    const o1 = await createOrder(db, w.alice);
    const p1 = await submitPayment(db, w.alice, o1.id, w.methodId);
    expect(await queue(w.admin)).toMatchObject({ payments_to_review: 1, orders_to_allocate: 0 });
    await approve(db, w.admin, p1.id, o1.total_cents);
    expect(await queue(w.admin)).toMatchObject({ payments_to_review: 0, orders_to_allocate: 1 });
    await allocate(db, w.admin, o1.id);
    expect(await queue(w.admin)).toMatchObject({ orders_to_allocate: 0 });

    await asUser(db, w.alice, () => db.query("select * from public.create_ticket('Help me please','other'::public.ticket_category,null,'hello')"));
    await db.query("insert into public.contact_messages (name, email, message) values ('Visitor','v@example.test','Do you sell Windows RDP?')");
    expect(await queue(w.support)).toMatchObject({ tickets_awaiting_staff: 1, unread_inbox: 1 });
  });

  it("KPIs and the revenue series are admin-only and add up from paid invoices (void invoices excluded)", async () => {
    const a = await deliverServer(w, w.alice); // $12
    await deliverServer(w, w.bob, { plan: "pro", loc: "united-states" }); // $28
    const range = ["2000-01-01T00:00:00Z", "2100-01-01T00:00:00Z"];
    const kpis = (uid: string) =>
      asUser(db, uid, async () => (await db.query<any>("select public.admin_kpis($1::timestamptz,$2::timestamptz) as k", range)).rows[0].k);

    await asUser(db, w.support, () => expectError(db.query("select public.admin_kpis($1::timestamptz,$2::timestamptz)", range), "FORBIDDEN"));
    await asUser(db, w.alice, () => expectError(db.query("select * from public.admin_revenue_series($1::timestamptz,$2::timestamptz)", range), "FORBIDDEN"));

    const k = await kpis(w.admin);
    expect(k.revenue_cents).toBe(1200 + 2800 + 1200); // includes the order delivered in the previous test
    expect(k.new_orders_completed).toBe(3);

    await asUser(db, w.admin, () =>
      db.query("select * from public.void_invoice((select id from public.invoices where order_id = $1), 'chargeback')", [a.order.id]),
    );
    const after = await kpis(w.admin);
    expect(after.revenue_cents).toBe(k.revenue_cents - 1200);

    const series = await asUser(db, w.admin, async () =>
      (await db.query<any>("select * from public.admin_revenue_series($1::timestamptz,$2::timestamptz,'month')", range)).rows);
    expect(series.reduce((s, r) => s + Number(r.revenue_cents), 0)).toBe(after.revenue_cents);
    await asUser(db, w.admin, () => expectError(db.query("select * from public.admin_revenue_series($1::timestamptz,$2::timestamptz,'hour')", range), "VALIDATION"));
  });
});
