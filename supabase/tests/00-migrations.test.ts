import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./harness";

describe("migrations + seed", () => {
  let db: Db;
  beforeAll(async () => {
    db = await createDb();
  });
  afterAll(async () => {
    await db.close();
  });

  it("applies every migration and the seed", async () => {
    const r = await db.query<{ n: number }>("select count(*)::int as n from public.plan_pricing");
    expect(r.rows[0]!.n).toBe(600); // 8 plans x 75 launch countries
  });

  it("seeds the 75 launch countries, 8 plans, and every payment method INACTIVE", async () => {
    expect((await db.query("select 1 from public.locations")).rows).toHaveLength(75);
    expect((await db.query("select 1 from public.plans")).rows).toHaveLength(8);
    const active = await db.query("select 1 from public.payment_methods where is_active");
    expect(active.rows).toHaveLength(0);
  });

  it("every table in public has RLS enabled", async () => {
    const r = await db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(r.rows.map((x) => x.relname)).toEqual([]);
  });

  it("the seed is idempotent (re-running changes nothing)", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const seed = readFileSync(path.resolve(__dirname, "..", "seed.sql"), "utf8");
    await db.exec(seed);
    const r = await db.query<{ n: number }>("select count(*)::int as n from public.plan_pricing");
    expect(r.rows[0]!.n).toBe(600);
  });
});
