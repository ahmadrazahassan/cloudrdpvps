import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, createUser, setRole, type Db } from "./harness";
import { activateMethod, asUser, createOrder, makeWorld, submitPayment, type World } from "./flows";

/** Staff are emailed about new payment proofs, tickets and contact messages — without ever receiving message text. */
describe("staff email alerts", () => {
  let db: Db;
  let w: World;
  beforeAll(async () => {
    db = await createDb();
    w = await makeWorld(db);
  });
  afterAll(async () => {
    await db.close();
  });

  const outbox = async (template: string, userId: string) =>
    (await db.query<any>("select * from public.email_outbox where template = $1 and user_id = $2 order by created_at", [template, userId])).rows;

  it("a payment proof alerts admins (not support, not the customer)", async () => {
    const method = await activateMethod(db);
    const order = await createOrder(db, w.alice);
    await submitPayment(db, w.alice, order.id, method);
    const forAdmin = await outbox("staff_payment_submitted", w.admin);
    expect(forAdmin).toHaveLength(1);
    expect(forAdmin[0].data).toMatchObject({ order_number: order.order_number, amount_cents: order.total_cents });
    expect(await outbox("staff_payment_submitted", w.support)).toHaveLength(0);
    expect(await outbox("staff_payment_submitted", w.alice)).toHaveLength(0);
  });

  it("a ticket and its replies alert support and admins, and carry no message text", async () => {
    const t = (
      await asUser(db, w.alice, () =>
        db.query<any>("select * from public.create_ticket($1,$2::public.ticket_category,$3::uuid,$4,$5)", ["Cannot connect", "technical", null, "My secret details: hunter2", "[]"]),
      )
    ).rows[0];
    for (const id of [w.admin, w.support]) {
      const rows = await outbox("staff_ticket", id);
      expect(rows).toHaveLength(1);
      expect(rows[0].data).toMatchObject({ ticket_no: t.ticket_no, subject: "Cannot connect", is_new: true });
      expect(JSON.stringify(rows[0].data)).not.toContain("hunter2");
    }
    await asUser(db, w.alice, () => db.query("select * from public.reply_to_ticket($1::uuid,$2,$3)", [t.id, "Any update?", "[]"]));
    const again = await outbox("staff_ticket", w.admin);
    expect(again).toHaveLength(2);
    expect(again[1].data).toMatchObject({ is_new: false });
  });

  it("staff replies and internal notes do not alert anyone", async () => {
    const before = (await db.query<any>("select count(*)::int as n from public.email_outbox where template = 'staff_ticket'")).rows[0].n;
    const t = (await db.query<any>("select id from public.tickets limit 1")).rows[0];
    await asUser(db, w.admin, () => db.query("select * from public.staff_reply_to_ticket($1::uuid,$2,$3,$4)", [t.id, "Looking into it", true, "[]"]));
    await asUser(db, w.admin, () => db.query("select * from public.staff_reply_to_ticket($1::uuid,$2,$3,$4)", [t.id, "Fixed", false, "[]"]));
    expect((await db.query<any>("select count(*)::int as n from public.email_outbox where template = 'staff_ticket'")).rows[0].n).toBe(before);
  });

  it("a contact-form message alerts support and admins; opting out and suspended staff are skipped", async () => {
    const quiet = await createUser(db);
    await setRole(db, quiet, "support");
    await db.query(`update public.profiles set notification_prefs = '{"staff_alerts": false}' where id = $1`, [quiet]);
    const gone = await createUser(db);
    await setRole(db, gone, "support");
    // status is guarded (admin RPCs only); the harness is the "database owner", so lift the guard for this one statement
    await db.query("select set_config('app.bypass_profile_guard', 'on', false)");
    await db.query("update public.profiles set status = 'suspended' where id = $1", [gone]);
    await db.query("select set_config('app.bypass_profile_guard', 'off', false)");

    await db.query("insert into public.contact_messages (name, email, topic, message) values ('Bilal', 'b@example.com', 'Sales', 'A long enough message about plans.')");
    expect(await outbox("staff_contact", w.admin)).toHaveLength(1);
    expect(await outbox("staff_contact", w.support)).toHaveLength(1);
    expect(await outbox("staff_contact", quiet)).toHaveLength(0);
    expect(await outbox("staff_contact", gone)).toHaveLength(0);
    expect(await outbox("staff_contact", w.alice)).toHaveLength(0);
  });
});
