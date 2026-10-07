import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, createUser, expectError, planAndLocation, type Db } from "./harness";
import { asAnon, asUser, createOrder, makeWorld, type World } from "./flows";

/** preview_coupon must give the same answer create_order would, write nothing, and work while signed out. */
describe("coupon preview (checkout)", () => {
  let db: Db;
  let w: World;
  let ids: { plan_id: string; location_id: string };

  beforeAll(async () => {
    db = await createDb();
    w = await makeWorld(db);
    ids = await planAndLocation(db, "rdp", "standard", "india"); // 12.00 USD
  });
  afterAll(async () => {
    await db.close();
  });

  const preview = (code: string, actor: "anon" | string = "anon") => {
    const run = () => db.query<any>("select * from public.preview_coupon($1::uuid,$2::uuid,$3)", [ids.plan_id, ids.location_id, code]);
    return actor === "anon" ? asAnon(db, run) : asUser(db, actor, run);
  };
  const mk = (code: string, type: string, value: number, extra = "") =>
    db.query(`insert into public.coupons (code, type, value ${extra ? ", " + extra.split("|")[0] : ""}) values ($1, $2::public.discount_type, $3 ${extra ? ", " + extra.split("|")[1] : ""})`, [code, type, value]);

  it("returns the discount and total, ignoring case and spaces, while signed out", async () => {
    await mk("PV25", "percent", 25);
    const r = (await preview("  pv25 ")).rows[0];
    expect(r).toMatchObject({ discount_cents: 300, list_price_cents: 1200, total_cents: 900 });
    await mk("PVFIXED", "fixed_usd", 200);
    expect((await preview("PVFIXED")).rows[0]).toMatchObject({ discount_cents: 200, total_cents: 1000 });
  });

  it("agrees with create_order for the same coupon", async () => {
    await mk("PVSAME", "percent", 15);
    const u = await createUser(db);
    const quoted = (await preview("PVSAME", u)).rows[0];
    const order = await createOrder(db, u, { coupon: "PVSAME" });
    expect(order.discount_cents).toBe(quoted.discount_cents);
    expect(order.total_cents).toBe(quoted.total_cents);
  });

  it("writes nothing: the redemption counter doesn't move", async () => {
    await mk("PVCOUNT", "percent", 10);
    await preview("PVCOUNT");
    await preview("PVCOUNT");
    const c = await db.query<any>("select redeemed_count from public.coupons where code = 'PVCOUNT'");
    expect(c.rows[0].redeemed_count).toBe(0);
  });

  it("refuses everything create_order would refuse", async () => {
    await expectError(preview("DOES-NOT-EXIST"), "COUPON_INVALID");
    await mk("PVOLD", "percent", 10, "ends_at|now() - interval '1 day'");
    await expectError(preview("PVOLD"), "COUPON_INVALID");
    await mk("PVFUTURE", "percent", 10, "starts_at|now() + interval '1 day'");
    await expectError(preview("PVFUTURE"), "COUPON_INVALID");
    await mk("PVVPS", "percent", 10, "applies_product|'vps'");
    await expectError(preview("PVVPS"), "COUPON_INVALID");
    await mk("PVBIG", "percent", 10, "min_order_cents|999999");
    await expectError(preview("PVBIG"), "COUPON_INVALID");
    await mk("PVFREE", "fixed_usd", 5000);
    await expectError(preview("PVFREE"), "COUPON_INVALID");
    await mk("PVALL", "percent", 100);
    await expectError(preview("PVALL"), "COUPON_INVALID");
    await db.query("update public.coupons set is_active = false where code = 'PVOLD'");
  });

  it("applies the per-customer limit once someone is signed in", async () => {
    await mk("PVONCE", "fixed_usd", 100);
    const u = await createUser(db);
    expect((await preview("PVONCE", u)).rows).toHaveLength(1);
    await createOrder(db, u, { coupon: "PVONCE" });
    await expectError(preview("PVONCE", u), "COUPON_INVALID");
    expect((await preview("PVONCE")).rows).toHaveLength(1); // a signed-out visitor can't be checked against a limit
  });

  it("won't quote a plan that isn't sold", async () => {
    await db.query("update public.plan_pricing set is_active = false where plan_id = $1 and location_id = $2", [ids.plan_id, ids.location_id]);
    await mk("PVGONE", "percent", 10);
    await expectError(preview("PVGONE"), "NOT_FOUND");
    await db.query("update public.plan_pricing set is_active = true where plan_id = $1 and location_id = $2", [ids.plan_id, ids.location_id]);
  });
});
