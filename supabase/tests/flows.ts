import { as, createUser, planAndLocation, sha, type Db } from "./harness";

export const asUser = <T>(db: Db, id: string, fn: () => Promise<T>) => as(db, { kind: "user", id }, fn);
export const asService = <T>(db: Db, fn: () => Promise<T>) => as(db, { kind: "service" }, fn);
export const asAnon = <T>(db: Db, fn: () => Promise<T>) => as(db, { kind: "anon" }, fn);

export type Row = Record<string, any>;

export async function createOrder(
  db: Db,
  uid: string,
  opts: { product?: string; plan?: string; loc?: string; coupon?: string | null; renew?: string | null } = {},
): Promise<Row> {
  const { plan_id, location_id } = await planAndLocation(db, opts.product ?? "rdp", opts.plan ?? "standard", opts.loc ?? "india");
  const r = await asUser(db, uid, () =>
    db.query<Row>("select * from public.create_order($1::uuid, $2::uuid, $3, $4::uuid)", [
      plan_id, location_id, opts.coupon ?? null, opts.renew ?? null,
    ]),
  );
  return r.rows[0]!;
}

/** Activate one seeded payment method (methods are seeded inactive). */
export async function activateMethod(db: Db, name = "UPI", rate: number | null = 83.5): Promise<string> {
  const r = await db.query<{ id: string }>(
    "update public.payment_methods set is_active = true, rate_per_usd = $2 where name = $1 returning id",
    [name, rate],
  );
  return r.rows[0]!.id;
}

export async function submitPayment(
  db: Db, uid: string, orderId: string, methodId: string,
  opts: { path?: string; reference?: string | null } = {},
): Promise<Row> {
  const path = opts.path ?? `${uid}/${orderId}/proof.png`;
  const r = await asUser(db, uid, () =>
    db.query<Row>("select * from public.submit_payment($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8)", [
      orderId, methodId, path, sha("a"), "image/png", 1234, opts.reference ?? "TXN-1", null,
    ]),
  );
  return r.rows[0]!;
}

export const approve = (db: Db, adminId: string, paymentId: string, received: number) =>
  asUser(db, adminId, () => db.query<Row>("select * from public.approve_payment($1::uuid,$2)", [paymentId, received]));

export async function allocate(
  db: Db, adminId: string, orderId: string,
  o: { item?: string | null; expires?: string | null; reason?: string | null; ip?: string } = {},
): Promise<Row> {
  const r = await asUser(db, adminId, () =>
    db.query<Row>(
      "select * from public.allocate_service($1::uuid,$2,$3,$4::inet,$5,$6,$7,$8::timestamptz,$9::timestamptz,$10::uuid,$11,$12)",
      [orderId, "My server", null, o.ip ?? "203.0.113.10", 3389, "Administrator", "v1.k1.iv.tag.ct", null, o.expires ?? null, o.item ?? null, o.reason ?? null, true],
    ),
  );
  return r.rows[0]!;
}

export interface World { db: Db; admin: string; support: string; alice: string; bob: string; methodId: string }

export async function makeWorld(db: Db): Promise<World> {
  const admin = await createUser(db, { email: "admin@example.test", role: "admin" });
  const support = await createUser(db, { email: "support@example.test", role: "support" });
  const alice = await createUser(db, { email: "alice@example.test" });
  const bob = await createUser(db, { email: "bob@example.test" });
  const methodId = await activateMethod(db);
  return { db, admin, support, alice, bob, methodId };
}

/** order -> proof -> approved -> delivered. Returns everything created. */
export async function deliverServer(w: World, uid = w.alice, opts: { plan?: string; loc?: string; product?: string; item?: string | null } = {}) {
  const order = await createOrder(w.db, uid, opts);
  const payment = await submitPayment(w.db, uid, order.id, w.methodId);
  await approve(w.db, w.admin, payment.id, order.total_cents);
  const service = await allocate(w.db, w.admin, order.id, { item: opts.item ?? null });
  return { order, payment, service };
}

export const secs = async (db: Db, a: string, b: string) =>
  Number((await db.query<{ s: string }>("select extract(epoch from ($1::timestamptz - $2::timestamptz))::float8 as s", [a, b])).rows[0]!.s);
