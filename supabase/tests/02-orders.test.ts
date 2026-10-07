import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, createUser, expectError, planAndLocation, sha, type Db } from "./harness";
import {
  activateMethod, allocate, approve, asUser, createOrder, deliverServer, makeWorld, secs, submitPayment, type World,
} from "./flows";

describe("orders: pricing, coupons and limits", () => {
  let db: Db;
  let w: World;
  beforeAll(async () => {
    db = await createDb();
    w = await makeWorld(db);
  });
  afterAll(async () => {
    await db.close();
  });

  it("computes the price on the server from the catalog, with a full snapshot", async () => {
    const o = await createOrder(db, w.alice); // RDP Standard · India
    expect(o.list_price_cents).toBe(1200);
    expect(o.total_cents).toBe(1200);
    expect(o.status).toBe("awaiting_payment");
    expect(o.order_number).toMatch(/^CRV-\d{6}$/);
    expect(o.plan_name).toBe("RDP Standard");
    expect(o.location_name).toBe("India");
    expect(o.plan_specs).toMatchObject({ vcpu: 4, ram_gb: 8, storage_gb: 120 });
    expect(o.term_days).toBe(30);
    const hours = (await secs(db, o.expires_at, o.created_at)) / 3600;
    expect(hours).toBeCloseTo(48, 0);
  });

  it("price changes after ordering do not alter an existing order (snapshot)", async () => {
    const o = await createOrder(db, w.bob, { plan: "pro", loc: "united-states" });
    await db.query("update public.plan_pricing set price_cents = 99900 where plan_id = $1", [o.plan_id]);
    const again = await db.query<any>("select total_cents from public.orders where id = $1", [o.id]);
    expect(again.rows[0].total_cents).toBe(2800);
    await db.query("update public.plan_pricing set price_cents = 2800 where plan_id = $1 and location_id = $2", [o.plan_id, o.location_id]);
  });

  it("rejects out-of-stock, inactive and unknown plans", async () => {
    const { plan_id, location_id } = await planAndLocation(db, "vps", "l", "united-kingdom");
    await db.query("update public.plan_pricing set stock = 'out_of_stock' where plan_id = $1 and location_id = $2", [plan_id, location_id]);
    await expectError(createOrder(db, w.alice, { product: "vps", plan: "l", loc: "united-kingdom" }), "OUT_OF_STOCK");
    await db.query("update public.plan_pricing set stock = 'low', is_active = false where plan_id = $1 and location_id = $2", [plan_id, location_id]);
    await expectError(createOrder(db, w.alice, { product: "vps", plan: "l", loc: "united-kingdom" }), "NOT_FOUND");
    await db.query("update public.plan_pricing set is_active = true where plan_id = $1 and location_id = $2", [plan_id, location_id]);
    // 'low' stock is still orderable
    const ok = await createOrder(db, w.alice, { product: "vps", plan: "l", loc: "united-kingdom" });
    expect(ok.total_cents).toBe(4400);
    await asUser(db, w.alice, () => db.query("select * from public.cancel_order($1::uuid)", [ok.id]));
  });

  it("requires a verified email, an active account, and no maintenance mode", async () => {
    const unverified = await createUser(db, { verified: false });
    await expectError(createOrder(db, unverified), "EMAIL_NOT_VERIFIED");

    const bad = await createUser(db);
    await asUser(db, w.admin, () => db.query("select * from public.set_account_status($1::uuid,'suspended','chargeback')", [bad]));
    await expectError(createOrder(db, bad), "ACCOUNT_SUSPENDED");

    await db.query(`update public.site_settings set value = '{"enabled": true, "message": "x"}' where key = 'maintenance'`);
    const ok = await createUser(db);
    await expectError(createOrder(db, ok), "MAINTENANCE");
    await db.query(`update public.site_settings set value = '{"enabled": false, "message": ""}' where key = 'maintenance'`);
  });

  it("caps open unpaid orders per user (default 3)", async () => {
    const u = await createUser(db);
    for (let i = 0; i < 3; i++) await createOrder(db, u);
    await expectError(createOrder(db, u), "TOO_MANY_OPEN_ORDERS");
  });

  describe("coupons", () => {
    const mk = (code: string, type: string, value: number, extra = "") =>
      db.query(`insert into public.coupons (code, type, value ${extra ? ", " + extra.split("|")[0] : ""}) values ($1, $2::public.discount_type, $3 ${extra ? ", " + extra.split("|")[1] : ""})`, [code, type, value]);

    it("applies a percentage discount (rounded down) and counts the redemption", async () => {
      await mk("SAVE25", "percent", 25);
      const u = await createUser(db);
      const o = await createOrder(db, u, { coupon: "save25" }); // case-insensitive
      expect(o.list_price_cents).toBe(1200);
      expect(o.discount_cents).toBe(300);
      expect(o.total_cents).toBe(900);
      expect(o.coupon_code).toBe("SAVE25");
      const c = await db.query<any>("select redeemed_count from public.coupons where code = 'SAVE25'");
      expect(c.rows[0].redeemed_count).toBe(1);
    });

    it("enforces the per-user limit, and cancelling an order gives the redemption back", async () => {
      await mk("ONCE", "fixed_usd", 200);
      const u = await createUser(db);
      const first = await createOrder(db, u, { coupon: "ONCE" });
      expect(first.total_cents).toBe(1000);
      await expectError(createOrder(db, u, { coupon: "ONCE" }), "COUPON_INVALID");
      await asUser(db, u, () => db.query("select * from public.cancel_order($1::uuid)", [first.id]));
      const c = await db.query<any>("select redeemed_count from public.coupons where code = 'ONCE'");
      expect(c.rows[0].redeemed_count).toBe(0);
      const again = await createOrder(db, u, { coupon: "ONCE" });
      expect(again.total_cents).toBe(1000);
    });

    it("never allows a free or negative order", async () => {
      await mk("FREE", "fixed_usd", 5000);
      await expectError(createOrder(db, w.alice, { coupon: "FREE" }), "COUPON_INVALID");
      await mk("ALL", "percent", 100);
      await expectError(createOrder(db, w.alice, { coupon: "ALL" }), "COUPON_INVALID");
    });

    it("respects dates, scope, minimum order and total redemption limits", async () => {
      await mk("OLD", "percent", 10, "ends_at|now() - interval '1 day'");
      await expectError(createOrder(db, w.alice, { coupon: "OLD" }), "COUPON_INVALID");
      await mk("FUTURE", "percent", 10, "starts_at|now() + interval '1 day'");
      await expectError(createOrder(db, w.alice, { coupon: "FUTURE" }), "COUPON_INVALID");
      await mk("VPSONLY", "percent", 10, "applies_product|'vps'");
      await expectError(createOrder(db, w.alice, { coupon: "VPSONLY" }), "COUPON_INVALID");
      await mk("BIGSPEND", "percent", 10, "min_order_cents|999999");
      await expectError(createOrder(db, w.alice, { coupon: "BIGSPEND" }), "COUPON_INVALID");
      await mk("LIMIT1", "percent", 10, "max_redemptions, per_user_limit|1, 5");
      const a = await createUser(db);
      const b = await createUser(db);
      await createOrder(db, a, { coupon: "LIMIT1" });
      await expectError(createOrder(db, b, { coupon: "LIMIT1" }), "COUPON_INVALID");
      await expectError(createOrder(db, w.alice, { coupon: "DOES-NOT-EXIST" }), "COUPON_INVALID");
    });

    it("customers cannot see, create or edit coupons (RLS: admin only)", async () => {
      const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.coupons");
      expect(rows[0]!.n).toBeGreaterThan(0); // there are coupons, so an empty result below is RLS, not an empty table
      await asUser(db, w.alice, async () => {
        expect((await db.query("select * from public.coupons")).rows).toHaveLength(0);
        await expectError(
          db.query("insert into public.coupons (code, type, value) values ('MINE', 'percent', 99)"),
          /row-level security/,
        );
        const upd = await db.query("update public.coupons set value = 99");
        expect(upd.affectedRows).toBe(0);
      });
      const intact = await db.query<{ n: number }>("select count(*)::int as n from public.coupons where value = 99");
      expect(intact.rows[0]!.n).toBe(0);
    });
  });
});

describe("orders: payment → approval → delivery", () => {
  let db: Db;
  let w: World;
  beforeAll(async () => {
    db = await createDb();
    w = await makeWorld(db);
  });
  afterAll(async () => {
    await db.close();
  });

  it("walks the whole happy path and leaves a clean audit trail", async () => {
    const order = await createOrder(db, w.alice);

    // proof must be inside the customer's own folder for THIS order
    await expectError(submitPayment(db, w.alice, order.id, w.methodId, { path: `${w.bob}/${order.id}/x.png` }), "UPLOAD_INVALID");
    await expectError(submitPayment(db, w.alice, order.id, w.methodId, { path: `${w.alice}/${w.bob}/x.png` }), "UPLOAD_INVALID");
    await expectError(submitPayment(db, w.alice, order.id, w.methodId, { path: `${w.alice}/${order.id}/../x.png` }), "UPLOAD_INVALID");

    const payment = await submitPayment(db, w.alice, order.id, w.methodId);
    expect(payment.status).toBe("pending");
    expect(payment.quoted_currency).toBe("INR");
    expect(Number(payment.quoted_amount)).toBe(1002); // $12 x 83.5
    const mid = (await db.query<any>("select status from public.orders where id = $1", [order.id])).rows[0];
    expect(mid.status).toBe("under_review");

    // a second pending proof for the same order is refused
    await expectError(submitPayment(db, w.alice, order.id, w.methodId), "CONFLICT");

    // staff cannot approve; admins must supply a sufficient amount
    await expectError(approve(db, w.support, payment.id, 1200), "FORBIDDEN");
    await expectError(approve(db, w.admin, payment.id, 1199), "AMOUNT_MISMATCH");
    const approved = (await approve(db, w.admin, payment.id, 1200)).rows[0]!;
    expect(approved.status).toBe("approved");
    await expectError(approve(db, w.admin, payment.id, 1200), "CONFLICT"); // not twice

    const inv = (await db.query<any>("select * from public.invoices where order_id = $1", [order.id])).rows;
    expect(inv).toHaveLength(1);
    expect(inv[0].invoice_number).toMatch(/^INV-\d{6}$/);
    expect(inv[0].total_cents).toBe(1200);
    expect(inv[0].billing_snapshot.order_number).toBe(order.order_number);

    // deliver
    const service = await allocate(db, w.admin, order.id);
    expect(service.status).toBe("active");
    expect(service.ip).toBe("203.0.113.10");
    expect(Math.round((await secs(db, service.expires_at, service.started_at)) / 86400)).toBe(30);
    expect((await db.query<any>("select status from public.orders where id = $1", [order.id])).rows[0].status).toBe("completed");
    await expectError(allocate(db, w.admin, order.id), "CONFLICT"); // single use per order

    // the customer is told, by notification and queued email — with no credentials in either
    const notes = (await db.query<any>("select type from public.notifications where user_id = $1", [w.alice])).rows.map((r) => r.type);
    expect(notes).toEqual(expect.arrayContaining(["order_placed", "payment_under_review", "payment_approved", "service_delivered"]));
    const mails = (await db.query<any>("select template from public.email_outbox where user_id = $1", [w.alice])).rows.map((r) => r.template);
    expect(mails).toEqual(expect.arrayContaining(["order_placed", "payment_under_review", "payment_approved", "service_delivered"]));

    const audit = (await db.query<any>("select action from public.audit_logs order by id")).rows.map((r) => r.action);
    expect(audit).toEqual(expect.arrayContaining(["payment.approve", "service.allocate"]));
    const events = (await db.query<any>("select event from public.order_events where order_id = $1 order by id", [order.id])).rows.map((r) => r.event);
    expect(events).toEqual(["created", "payment_submitted", "payment_approved", "service_delivered"]);
  });

  it("requires a reason for a non-standard expiry at delivery", async () => {
    const order = await createOrder(db, w.bob);
    const p = await submitPayment(db, w.bob, order.id, w.methodId);
    await approve(db, w.admin, p.id, order.total_cents);
    const custom = new Date(Date.now() + 10 * 86400_000).toISOString();
    await expectError(allocate(db, w.admin, order.id, { expires: custom }), "REASON_REQUIRED");
    const s = await allocate(db, w.admin, order.id, { expires: custom, reason: "goodwill: late delivery" });
    expect(new Date(s.expires_at).getTime()).toBeCloseTo(new Date(custom).getTime(), -3);
  });

  it("cannot deliver an order that was never paid", async () => {
    const order = await createOrder(db, w.alice);
    await expectError(allocate(db, w.admin, order.id), "CONFLICT");
  });

  it("a rejected proof returns the order to the customer, with a longer deadline, and they can resubmit", async () => {
    const order = await createOrder(db, w.alice);
    const p = await submitPayment(db, w.alice, order.id, w.methodId);
    await expectError(asUser(db, w.admin, () => db.query("select * from public.reject_payment($1::uuid, '')", [p.id])), "REASON_REQUIRED");
    const rejected = (await asUser(db, w.admin, () => db.query<any>("select * from public.reject_payment($1::uuid, 'Amount mismatch', 'Screenshot shows $9')", [p.id]))).rows[0]!;
    expect(rejected.status).toBe("rejected");
    expect((await secs(db, rejected.expires_at, order.expires_at)) / 3600).toBeGreaterThan(20);
    const again = await submitPayment(db, w.alice, order.id, w.methodId, { path: `${w.alice}/${order.id}/proof2.png`, reference: "TXN-2" });
    expect(again.status).toBe("pending");
    const st = (await db.query<any>("select status from public.orders where id = $1", [order.id])).rows[0].status;
    expect(st).toBe("under_review");
  });

  it("customers can cancel unpaid orders only; admins need a reason", async () => {
    const o1 = await createOrder(db, w.alice);
    await asUser(db, w.alice, () => db.query("select * from public.cancel_order($1::uuid)", [o1.id]));
    const o2 = await createOrder(db, w.alice);
    await submitPayment(db, w.alice, o2.id, w.methodId);
    await asUser(db, w.alice, () => expectError(db.query("select * from public.cancel_order($1::uuid)", [o2.id]), "CONFLICT"));
    await expectError(asUser(db, w.admin, () => db.query("select * from public.admin_cancel_order($1::uuid, '')", [o2.id])), "REASON_REQUIRED");
    const c = (await asUser(db, w.admin, () => db.query<any>("select * from public.admin_cancel_order($1::uuid, 'fraud suspected')", [o2.id]))).rows[0]!;
    expect(c.status).toBe("cancelled");
    // the pending proof can no longer be approved
    const pend = await db.query<any>("select status from public.payments where order_id = $1", [o2.id]);
    expect(pend.rows[0].status).toBe("rejected");
  });

  it("records refunds (bounded by what was paid) without deleting history", async () => {
    const { order } = await deliverServer(w, w.bob);
    await expectError(asUser(db, w.admin, () => db.query("select * from public.mark_order_refunded($1::uuid, 999999, 'x')", [order.id])), "VALIDATION");
    const r = (await asUser(db, w.admin, () => db.query<any>("select * from public.mark_order_refunded($1::uuid, 1200, 'duplicate payment')", [order.id]))).rows[0]!;
    expect(r.status).toBe("refunded");
    const inv = (await db.query<any>("select status from public.invoices where order_id = $1", [order.id])).rows[0];
    expect(inv.status).toBe("paid"); // voiding is a separate, explicit admin action
    const v = (await asUser(db, w.admin, () => db.query<any>("select * from public.void_invoice((select id from public.invoices where order_id = $1), 'refunded')", [order.id]))).rows[0]!;
    expect(v.status).toBe("void");
  });
});

describe("renewals extend from max(now, expiry) by exactly 30 days", () => {
  let db: Db;
  let w: World;
  beforeAll(async () => {
    db = await createDb();
    w = await makeWorld(db);
  });
  afterAll(async () => {
    await db.close();
  });

  const renew = async (serviceId: string, uid = w.alice) => {
    const { plan_id, location_id } = await planAndLocation(db);
    const r = await asUser(db, uid, () =>
      db.query<any>("select * from public.create_order($1::uuid,$2::uuid,null,$3::uuid)", [plan_id, location_id, serviceId]),
    );
    return r.rows[0]!;
  };
  const pay = async (order: any, uid = w.alice) => {
    const p = await submitPayment(db, uid, order.id, w.methodId);
    return (await approve(db, w.admin, p.id, order.total_cents)).rows[0]!;
  };

  it("an active service is extended from its current expiry (no days are lost)", async () => {
    const { service } = await deliverServer(w);
    await db.query("update public.services set expires_at = now() + interval '5 days' where id = $1", [service.id]);
    const before = (await db.query<any>("select expires_at from public.services where id = $1", [service.id])).rows[0].expires_at;
    const order = await renew(service.id);
    expect(order.type).toBe("renewal");
    expect(order.service_id).toBe(service.id);
    const done = await pay(order);
    expect(done.status).toBe("completed");
    const after = (await db.query<any>("select expires_at, status from public.services where id = $1", [service.id])).rows[0];
    expect(await secs(db, after.expires_at, before)).toBeCloseTo(30 * 86400, -1);
    expect(after.status).toBe("active");
  });

  it("an expired service restarts from now and becomes active again", async () => {
    const { service } = await deliverServer(w);
    await db.query("update public.services set expires_at = now() - interval '3 days', status = 'expired' where id = $1", [service.id]);
    const order = await renew(service.id);
    await pay(order);
    const after = (await db.query<any>("select expires_at, status from public.services where id = $1", [service.id])).rows[0];
    expect(after.status).toBe("active");
    const fromNow = await secs(db, after.expires_at, new Date().toISOString());
    expect(fromNow / 86400).toBeGreaterThan(29.9);
    expect(fromNow / 86400).toBeLessThan(30.1);
  });

  it("only one renewal can be pending, only the owner can renew, terminated services can't", async () => {
    const { service } = await deliverServer(w);
    const o = await renew(service.id);
    await expectError(renew(service.id), "RENEWAL_PENDING");
    await expectError(renew(service.id, w.bob), "NOT_FOUND");
    await asUser(db, w.alice, () => db.query("select * from public.cancel_order($1::uuid)", [o.id]));

    await asUser(db, w.admin, () => db.query("select * from public.terminate_service($1::uuid, 'abuse')", [service.id]));
    await expectError(renew(service.id), "CONFLICT");
  });

  it("renewals use today's price, even for plans no longer sold (PLAN_UNAVAILABLE)", async () => {
    const { service } = await deliverServer(w);
    await db.query("update public.plan_pricing set price_cents = 1500 where plan_id = $1 and location_id = $2", [service.plan_id, service.location_id]);
    const o = await renew(service.id);
    expect(o.total_cents).toBe(1500);
    await asUser(db, w.alice, () => db.query("select * from public.cancel_order($1::uuid)", [o.id]));
    await db.query("update public.plan_pricing set is_active = false where plan_id = $1 and location_id = $2", [service.plan_id, service.location_id]);
    await expectError(renew(service.id), "PLAN_UNAVAILABLE");
  });
});

describe("inventory and service lifecycle", () => {
  let db: Db;
  let w: World;
  beforeAll(async () => {
    db = await createDb();
    w = await makeWorld(db);
  });
  afterAll(async () => {
    await db.close();
  });

  const item = async (slug: string, ip: string, product = "rdp") =>
    (await db.query<{ id: string }>(
      `insert into public.inventory_items (product, location_id, ip, username, password_enc, supplier_cost_cents)
       select $1::public.product_type, id, $3::inet, 'Administrator', 'v1.k1.a.b.c', 400 from public.locations where slug = $2 returning id`,
      [product, slug, ip],
    )).rows[0]!.id;

  it("allocates a matching stock item exactly once", async () => {
    const stock = await item("india", "198.51.100.10");
    const { service } = await deliverServer(w, w.alice, { item: stock });
    const st = (await db.query<any>("select status, allocated_service_id from public.inventory_items where id = $1", [stock])).rows[0];
    expect(st.status).toBe("allocated");
    expect(st.allocated_service_id).toBe(service.id);

    const o2 = await createOrder(db, w.bob);
    const p2 = await submitPayment(db, w.bob, o2.id, w.methodId);
    await approve(db, w.admin, p2.id, o2.total_cents);
    await expectError(allocate(db, w.admin, o2.id, { item: stock }), "CONFLICT"); // already allocated
  });

  it("refuses stock from the wrong location or product", async () => {
    const wrongLoc = await item("bangladesh", "198.51.100.11");
    const o = await createOrder(db, w.bob);
    const p = await submitPayment(db, w.bob, o.id, w.methodId);
    await approve(db, w.admin, p.id, o.total_cents);
    await expectError(allocate(db, w.admin, o.id, { item: wrongLoc }), "CONFLICT");
    const wrongProduct = await item("india", "198.51.100.12", "vps");
    await expectError(allocate(db, w.admin, o.id, { item: wrongProduct }), "CONFLICT");
  });

  it("terminating retires the stock item and deletes the stored credentials", async () => {
    const stock = await item("india", "198.51.100.13");
    const { service } = await deliverServer(w, w.alice, { item: stock });
    await expectError(asUser(db, w.admin, () => db.query("select * from public.terminate_service($1::uuid, '')", [service.id])), "REASON_REQUIRED");
    await asUser(db, w.admin, () => db.query("select * from public.terminate_service($1::uuid, 'contract ended')", [service.id]));
    expect((await db.query<any>("select status from public.inventory_items where id = $1", [stock])).rows[0].status).toBe("retired");
    expect((await db.query("select 1 from public.service_credentials where service_id = $1", [service.id])).rows).toHaveLength(0);
    await asUser(db, w.alice, () => expectError(db.query("select * from public.get_service_credentials($1::uuid)", [service.id]), "SERVICE_NOT_ACTIVE"));
  });

  it("extend / suspend / unsuspend enforce reasons and state rules", async () => {
    const { service } = await deliverServer(w, w.bob);
    const base = (await db.query<any>("select expires_at from public.services where id = $1", [service.id])).rows[0].expires_at;

    // standard +30 days needs no reason; custom does
    await asUser(db, w.admin, () => db.query("select * from public.extend_service($1::uuid, 30)", [service.id]));
    const ext = (await db.query<any>("select expires_at from public.services where id = $1", [service.id])).rows[0].expires_at;
    expect(await secs(db, ext, base)).toBeCloseTo(30 * 86400, -1);
    await expectError(asUser(db, w.admin, () => db.query("select * from public.extend_service($1::uuid, 7)", [service.id])), "REASON_REQUIRED");
    await asUser(db, w.admin, () => db.query("select * from public.extend_service($1::uuid, 7, null, 'apology')", [service.id]));
    await expectError(asUser(db, w.admin, () => db.query("select * from public.extend_service($1::uuid, 7, now() + interval '2 days', 'x')", [service.id])), "VALIDATION");

    await expectError(asUser(db, w.admin, () => db.query("select * from public.suspend_service($1::uuid, '')", [service.id])), "REASON_REQUIRED");
    await asUser(db, w.admin, () => db.query("select * from public.suspend_service($1::uuid, 'ToS violation')", [service.id]));
    await expectError(asUser(db, w.admin, () => db.query("select * from public.suspend_service($1::uuid, 'again')", [service.id])), "CONFLICT");
    const s = (await db.query<any>("select status, suspended_reason from public.services where id = $1", [service.id])).rows[0];
    expect(s).toMatchObject({ status: "suspended", suspended_reason: "ToS violation" });
    await asUser(db, w.admin, () => db.query("select * from public.unsuspend_service($1::uuid)", [service.id]));
    expect((await db.query<any>("select status, suspended_reason from public.services where id = $1", [service.id])).rows[0]).toMatchObject({ status: "active", suspended_reason: null });
  });

  it("customers can rename their own service only (1–60 chars)", async () => {
    const { service } = await deliverServer(w, w.alice);
    const r = await asUser(db, w.alice, () => db.query<any>("select * from public.rename_service($1::uuid, '  Trading-1  ')", [service.id]));
    expect(r.rows[0].label).toBe("Trading-1");
    await asUser(db, w.alice, () => expectError(db.query("select * from public.rename_service($1::uuid, '')", [service.id]), "VALIDATION"));
    await asUser(db, w.bob, () => expectError(db.query("select * from public.rename_service($1::uuid, 'mine now')", [service.id]), "NOT_FOUND"));
  });

  it("services_v reports the effective status without waiting for the nightly job", async () => {
    const { service } = await deliverServer(w, w.alice);
    await db.query("update public.services set expires_at = now() - interval '1 hour' where id = $1", [service.id]);
    const v = await asUser(db, w.alice, async () => (await db.query<any>("select status, effective_status, days_left from public.services_v where id = $1", [service.id])).rows[0]);
    expect(v).toMatchObject({ status: "active", effective_status: "expired", days_left: 0 });
  });
});

void sha; void activateMethod;
