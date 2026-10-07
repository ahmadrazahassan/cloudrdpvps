import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createDb, createUser, expectError, setRole, sha, type Db } from "./harness";
import { asAnon, asService, asUser, createOrder, deliverServer, makeWorld, type World } from "./flows";

describe("security: access control", () => {
  let db: Db;
  let w: World;
  beforeAll(async () => {
    db = await createDb();
    w = await makeWorld(db);
  });
  afterAll(async () => {
    await db.close();
  });

  describe("anonymous visitors", () => {
    it("can read the active public catalog", async () => {
      const r = await asAnon(db, async () => ({
        locations: (await db.query("select 1 from public.locations")).rows.length,
        plans: (await db.query("select 1 from public.plans")).rows.length,
        pricing: (await db.query("select 1 from public.plan_pricing")).rows.length,
        faqs: (await db.query("select 1 from public.faqs")).rows.length,
      }));
      expect(r).toEqual({ locations: 75, plans: 8, pricing: 600, faqs: 8 });
    });

    it("only sees PUBLIC settings", async () => {
      const keys = await asAnon(db, async () => (await db.query<{ key: string }>("select key from public.site_settings")).rows.map((r) => r.key));
      expect(keys).toContain("term_days");
      expect(keys).not.toContain("unpaid_order_hours");
      expect(keys).not.toContain("require_staff_mfa");
    });

    it("cannot read private tables or payment-method account details", async () => {
      for (const t of ["profiles", "orders", "payments", "services", "invoices", "payment_methods", "audit_logs", "notifications"]) {
        await asAnon(db, () => expectError(db.query(`select * from public.${t}`), /permission denied/));
      }
    });

    it("sees active payment methods only through the safe view (none are active by default)", async () => {
      await db.exec("update public.payment_methods set is_active = false");
      const r = await asAnon(db, async () => (await db.query("select * from public.payment_methods_public")).rows);
      expect(r).toHaveLength(0);
      await db.exec("update public.payment_methods set is_active = true where name = 'UPI'");
      const r2 = await asAnon(db, async () => (await db.query<{ name: string }>("select * from public.payment_methods_public")).rows);
      expect(r2.map((x) => x.name)).toEqual(["UPI"]);
      // the safe view exposes no account details
      expect(Object.keys(r2[0]!).sort()).toEqual(["id", "name", "regions", "sort_order", "type"]);
    });

    it("cannot reach payment-method account details even by naming the columns", async () => {
      await db.exec("update public.payment_methods set is_active = true, details = '[{\"label\":\"IBAN\",\"value\":\"SECRET-123\"}]'::jsonb, qr_path = 'x/y.png', instructions_md = 'secret steps' where name = 'UPI'");
      for (const col of ["details", "qr_path", "instructions_md", "rate_per_usd", "fee_note", "requires_reference", "currency_code"]) {
        await asAnon(db, () => expectError(db.query(`select ${col} from public.payment_methods`), /permission denied/));
      }
      // the six safe columns are readable, for ACTIVE rows only
      const safe = await asAnon(db, async () => (await db.query<{ name: string }>("select id, name, type, regions, sort_order, is_active from public.payment_methods")).rows);
      expect(safe.map((r) => r.name)).toEqual(["UPI"]);
      await db.exec("update public.payment_methods set is_active = false where name = 'UPI'");
      expect(await asAnon(db, async () => (await db.query("select name from public.payment_methods")).rows)).toHaveLength(0);
      // leave the shared fixture as the other suites expect it: UPI active, no leftover secrets
      await db.exec("update public.payment_methods set is_active = true, details = '[]'::jsonb, qr_path = null, instructions_md = null where name = 'UPI'");
    });

    it("cannot call any RPC (or the internal term_days helper — the order RPCs still use it, see 02-orders)", async () => {
      await asAnon(db, () =>
        expectError(db.query("select * from public.create_order(gen_random_uuid(), gen_random_uuid())"), /permission denied/),
      );
      await asAnon(db, () => expectError(db.query("select public.cancel_stale_orders()"), /permission denied/));
      await asAnon(db, () => expectError(db.query("select public.term_days()"), /permission denied/));
      await asUser(db, w.alice, () => expectError(db.query("select public.term_days()"), /permission denied/));
    });
  });

  describe("tenant isolation", () => {
    let aliceOrder: Record<string, any>;
    beforeAll(async () => {
      aliceOrder = await createOrder(db, w.alice);
    });

    it("a customer sees only their own orders", async () => {
      const mine = await asUser(db, w.alice, async () => (await db.query("select 1 from public.orders")).rows.length);
      const theirs = await asUser(db, w.bob, async () => (await db.query("select 1 from public.orders")).rows.length);
      expect(mine).toBe(1);
      expect(theirs).toBe(0);
    });

    it("another customer cannot read, cancel or pay someone else's order", async () => {
      await asUser(db, w.bob, () => expectError(db.query("select * from public.cancel_order($1::uuid)", [aliceOrder.id]), "NOT_FOUND"));
      await asUser(db, w.bob, () =>
        expectError(
          db.query("select * from public.submit_payment($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8)", [
            aliceOrder.id, w.methodId, `${w.bob}/${aliceOrder.id}/p.png`, sha("a"), "image/png", 10, "ref", null,
          ]),
          "NOT_FOUND",
        ),
      );
    });

    it("notifications are private to their owner", async () => {
      const bobs = await asUser(db, w.bob, async () => (await db.query("select 1 from public.notifications")).rows.length);
      const alices = await asUser(db, w.alice, async () => (await db.query("select 1 from public.notifications")).rows.length);
      expect(bobs).toBe(0);
      expect(alices).toBeGreaterThan(0);
    });

    it("customers cannot write money or state tables directly", async () => {
      await asUser(db, w.alice, () =>
        expectError(
          db.query(
            `insert into public.orders (user_id, plan_id, location_id, product, plan_name, plan_specs, location_name,
              list_price_cents, discount_cents, total_cents, expires_at)
             select $1::uuid, id, (select id from public.locations limit 1), 'rdp', 'x', '{}', 'x', 1, 0, 1, now() from public.plans limit 1`,
            [w.alice],
          ),
          /permission denied/,
        ),
      );
      await asUser(db, w.alice, () => expectError(db.query("update public.orders set total_cents = 1"), /permission denied/));
      // admins edit prices through this table, so the grant exists — RLS must filter every row out for customers
      const upd = await asUser(db, w.alice, () => db.query("update public.plan_pricing set price_cents = 0"));
      expect(upd.affectedRows).toBe(0);
      const zero = await db.query("select 1 from public.plan_pricing where price_cents = 0");
      expect(zero.rows).toHaveLength(0);
      const ins = await asUser(db, w.alice, () =>
        expectError(db.query("insert into public.plans (product, name, slug, vcpu, ram_gb, storage_gb, bandwidth_tb, port_mbps) values ('rdp','x','x',1,1,1,1,1)"), /row-level security/));
      expect(ins).toBeTruthy();
      await asUser(db, w.alice, () => expectError(db.query("delete from public.invoices"), /permission denied/));
    });
  });

  describe("privilege escalation", () => {
    it("a customer can edit their name but not their role, status or email", async () => {
      await asUser(db, w.alice, () => db.query("update public.profiles set full_name = 'Alice A.' where id = $1", [w.alice]));
      const name = (await db.query<{ full_name: string }>("select full_name from public.profiles where id = $1", [w.alice])).rows[0]!.full_name;
      expect(name).toBe("Alice A.");
      for (const col of ["role = 'admin'", "status = 'suspended'", "email = 'x@x.test'"]) {
        await asUser(db, w.alice, () => expectError(db.query(`update public.profiles set ${col} where id = $1`, [w.alice]), /permission denied/));
      }
    });

    it("even a superuser session cannot flip a role without the admin RPC (guard trigger)", async () => {
      await expectError(db.query("update public.profiles set role = 'admin' where id = $1", [w.bob]), "FORBIDDEN");
    });

    it("a customer cannot edit another customer's profile", async () => {
      const r = await asUser(db, w.alice, () => db.query("update public.profiles set full_name = 'hacked' where id = $1", [w.bob]));
      expect(r.affectedRows).toBe(0);
    });

    it("signing up with {role: 'admin'} in user metadata still creates a customer", async () => {
      const id = await db.query<{ id: string }>(
        `insert into auth.users (email, raw_user_meta_data, email_confirmed_at)
         values ('sneaky@example.test', '{"role":"admin","full_name":"Sneaky"}', now()) returning id`,
      );
      const p = await db.query<{ role: string }>("select role from public.profiles where id = $1", [id.rows[0]!.id]);
      expect(p.rows[0]!.role).toBe("customer");
    });

    it("customers and support cannot call admin RPCs", async () => {
      await asUser(db, w.alice, () => expectError(db.query("select * from public.approve_payment(gen_random_uuid(), 100)"), "FORBIDDEN"));
      await asUser(db, w.alice, () => expectError(db.query("select public.admin_kpis(now() - interval '1 day', now())"), "FORBIDDEN"));
      await asUser(db, w.support, () => expectError(db.query("select * from public.approve_payment(gen_random_uuid(), 100)"), "FORBIDDEN"));
      await asUser(db, w.support, () => expectError(db.query("select public.admin_kpis(now() - interval '1 day', now())"), "FORBIDDEN"));
      await asUser(db, w.alice, () => expectError(db.query("select public.admin_action_queue()"), "FORBIDDEN"));
    });

    it("support can see the action queue; admins can see KPIs", async () => {
      const q = await asUser(db, w.support, async () => (await db.query<{ admin_action_queue: Record<string, unknown> }>("select public.admin_action_queue()")).rows[0]!.admin_action_queue);
      expect(q).toHaveProperty("payments_to_review");
      const k = await asUser(db, w.admin, async () => (await db.query<{ admin_kpis: Record<string, unknown> }>("select public.admin_kpis(now() - interval '1 day', now() + interval '1 day')")).rows[0]!.admin_kpis);
      expect(k).toHaveProperty("revenue_cents");
    });

    it("a suspended admin loses every privilege immediately", async () => {
      const temp = await createUser(db, { role: "admin" });
      await asUser(db, w.admin, () => db.query("select * from public.set_account_status($1::uuid, 'suspended', 'test')", [temp]));
      await asUser(db, temp, () => expectError(db.query("select public.admin_action_queue()"), "FORBIDDEN"));
      await asUser(db, w.admin, () => db.query("select * from public.set_account_status($1::uuid, 'active')", [temp]));
    });

    it("an admin cannot change their own role or status", async () => {
      await asUser(db, w.admin, () => expectError(db.query("select * from public.set_user_role($1::uuid, 'customer')", [w.admin]), "FORBIDDEN"));
      await asUser(db, w.admin, () => expectError(db.query("select * from public.set_account_status($1::uuid, 'suspended', 'x')", [w.admin]), "FORBIDDEN"));
    });
  });

  describe("secrets stay secret", () => {
    let serviceId: string;
    beforeAll(async () => {
      const { service } = await deliverServer(w);
      serviceId = service.id;
    });

    it("service_credentials is unreadable by every client role, admins included", async () => {
      await asUser(db, w.alice, () => expectError(db.query("select * from public.service_credentials"), /permission denied/));
      await asUser(db, w.admin, () => expectError(db.query("select * from public.service_credentials"), /permission denied/));
      await asAnon(db, () => expectError(db.query("select * from public.service_credentials"), /permission denied/));
    });

    it("the encrypted inventory password is never selectable (even by admins)", async () => {
      await db.query(
        `insert into public.inventory_items (product, location_id, ip, username, password_enc)
         select 'rdp', id, '198.51.100.7', 'administrator', 'v1.k1.a.b.c' from public.locations where slug = 'india'`,
      );
      await asUser(db, w.admin, () => expectError(db.query("select password_enc from public.inventory_items"), /permission denied/));
      await asUser(db, w.admin, () => expectError(db.query("select * from public.inventory_items"), /permission denied/));
      const ok = await asUser(db, w.admin, async () => (await db.query("select id, ip, username, status from public.inventory_items")).rows);
      expect(ok).toHaveLength(1);
      // support / customers see no inventory rows at all
      const s = await asUser(db, w.support, async () => (await db.query("select id from public.inventory_items")).rows);
      expect(s).toHaveLength(0);
    });

    it("only the owner (while active) or an admin gets credentials back — as ciphertext", async () => {
      const mine = await asUser(db, w.alice, async () => (await db.query<any>("select * from public.get_service_credentials($1::uuid)", [serviceId])).rows[0]);
      expect(mine.password_enc.startsWith("v1.")).toBe(true);
      await asUser(db, w.bob, () => expectError(db.query("select * from public.get_service_credentials($1::uuid)", [serviceId]), "FORBIDDEN"));
      await asUser(db, w.support, () => expectError(db.query("select * from public.get_service_credentials($1::uuid)", [serviceId]), "FORBIDDEN"));
      await asAnon(db, () => expectError(db.query("select * from public.get_service_credentials($1::uuid)", [serviceId]), /permission denied/));
      const adm = await asUser(db, w.admin, async () => (await db.query<any>("select * from public.get_service_credentials($1::uuid)", [serviceId])).rows);
      expect(adm).toHaveLength(1);
    });

    it("every reveal is audited with the actor", async () => {
      const rows = await db.query<any>("select action, actor_id from public.audit_logs where entity_id = $1 and action like 'credentials.reveal%'", [serviceId]);
      expect(rows.rows.map((r) => r.action).sort()).toEqual(["credentials.reveal", "credentials.reveal.admin"]);
      expect(rows.rows.find((r) => r.action === "credentials.reveal")!.actor_id).toBe(w.alice);
    });

    it("the owner loses access when the service is suspended or expired", async () => {
      await asUser(db, w.admin, () => db.query("select * from public.suspend_service($1::uuid, 'abuse report')", [serviceId]));
      await asUser(db, w.alice, () => expectError(db.query("select * from public.get_service_credentials($1::uuid)", [serviceId]), "SERVICE_NOT_ACTIVE"));
      await asUser(db, w.admin, () => db.query("select * from public.unsuspend_service($1::uuid)", [serviceId]));
      await db.query("update public.services set expires_at = now() - interval '1 hour' where id = $1", [serviceId]);
      await asUser(db, w.alice, () => expectError(db.query("select * from public.get_service_credentials($1::uuid)", [serviceId]), "SERVICE_NOT_ACTIVE"));
    });

    it("no credentials ever reach the email queue or audit log", async () => {
      const text = JSON.stringify((await db.query("select * from public.email_outbox")).rows) +
                   JSON.stringify((await db.query("select * from public.audit_logs")).rows) +
                   JSON.stringify((await db.query("select * from public.notifications")).rows);
      expect(text).not.toContain("v1.k1.iv.tag.ct");
      expect(text.toLowerCase()).not.toContain("password");
    });
  });

  describe("audit log is append-only", () => {
    it("admins cannot update or delete it", async () => {
      await asUser(db, w.admin, () => expectError(db.query("update public.audit_logs set action = 'x'"), /permission denied/));
      await asUser(db, w.admin, () => expectError(db.query("delete from public.audit_logs"), /permission denied/));
    });
    it("not even a superuser can (trigger)", async () => {
      await expectError(db.query("update public.audit_logs set action = 'x'"), "AUDIT_IMMUTABLE");
      await expectError(db.query("delete from public.audit_logs"), "AUDIT_IMMUTABLE");
      await expectError(db.query("truncate public.audit_logs"), "AUDIT_IMMUTABLE");
    });
    it("admin catalog edits are audited automatically with before/after", async () => {
      await asUser(db, w.admin, () =>
        db.query(
          `update public.plan_pricing set price_cents = 1300
            where plan_id = (select id from public.plans where slug = 'standard' and product = 'rdp')
              and location_id = (select id from public.locations where slug = 'india')`,
        ),
      );
      const r = await db.query<any>("select before, after, actor_id from public.audit_logs where action = 'plan_pricing.update' order by id desc limit 1");
      expect(r.rows[0].before.price_cents).toBe(1200);
      expect(r.rows[0].after.price_cents).toBe(1300);
      expect(r.rows[0].actor_id).toBe(w.admin);
    });
  });

  describe("storage policies", () => {
    it("customers can upload only inside their own folder and can't read others' proofs", async () => {
      await asUser(db, w.alice, () =>
        db.query("insert into storage.objects (bucket_id, name) values ('payment-proofs', $1)", [`${w.alice}/order-1/proof.png`]),
      );
      await asUser(db, w.alice, () =>
        expectError(db.query("insert into storage.objects (bucket_id, name) values ('payment-proofs', $1)", [`${w.bob}/order-1/evil.png`]), /row-level security/),
      );
      const bobSees = await asUser(db, w.bob, async () => (await db.query("select name from storage.objects where bucket_id = 'payment-proofs'")).rows);
      expect(bobSees).toHaveLength(0);
      const staffSees = await asUser(db, w.support, async () => (await db.query("select name from storage.objects where bucket_id = 'payment-proofs'")).rows);
      expect(staffSees).toHaveLength(1);
    });
    it("customers cannot modify or delete uploaded proofs (immutable evidence)", async () => {
      const u = await asUser(db, w.alice, () => db.query("update storage.objects set name = name || 'x' where bucket_id = 'payment-proofs'"));
      expect(u.affectedRows).toBe(0);
      const d = await asUser(db, w.alice, () => db.query("delete from storage.objects where bucket_id = 'payment-proofs'"));
      expect(d.affectedRows).toBe(0);
    });
  });

  describe("service role", () => {
    it("can run maintenance jobs; promotes the first admin only once", async () => {
      await asService(db, () => db.query("select public.cancel_stale_orders()"));
      const first = await createUser(db, { email: "boss@example.test" });
      // an admin already exists in this DB -> refuse
      await asService(db, () => expectError(db.query("select public.bootstrap_first_admin('boss@example.test')"), "CONFLICT"));
      // fresh DB with no admin -> works
      const fresh = await createDb();
      const id = await createUser(fresh, { email: "boss@example.test" });
      const out = await asService(fresh, async () => (await fresh.query<{ bootstrap_first_admin: string }>("select public.bootstrap_first_admin('boss@example.test')")).rows[0]!.bootstrap_first_admin);
      expect(out).toBe(id);
      expect((await fresh.query<{ role: string }>("select role from public.profiles where id = $1", [id])).rows[0]!.role).toBe("admin");
      await asService(fresh, () => expectError(fresh.query("select public.bootstrap_first_admin('boss@example.test')"), "CONFLICT"));
      await fresh.close();
      expect(first).toBeTruthy();
      // an ordinary signed-in user may never bootstrap
      await asUser(db, w.alice, () => expectError(db.query("select public.bootstrap_first_admin('alice@example.test')"), /permission denied/));
    });
  });

  it("profile email follows auth.users email changes", async () => {
    const id = await createUser(db, { email: "old@example.test" });
    await db.query("update auth.users set email = 'new@example.test' where id = $1", [id]);
    const p = await db.query<{ email: string }>("select email from public.profiles where id = $1", [id]);
    expect(p.rows[0]!.email).toBe("new@example.test");
  });
});

// keep helpers referenced for type-checking of unused imports
void as; void setRole;
