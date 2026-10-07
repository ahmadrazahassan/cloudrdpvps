/**
 * Put the launch countries (src/content/launch.json) into the live database, once:
 *
 *   npm run launch:apply            shows what it would change and writes nothing
 *   npm run launch:apply -- --apply makes the change
 *
 * It switches on the launch countries for Windows RDP and Windows VPS (adding each one's location and a price for every plan, by the
 * file's tiers), gives the two that launched with short names their real names (USA → United States, UK → United Kingdom),
 * and switches OFF Pakistan — we don't host there — without deleting anything. Prices that already exist are never changed.
 * Idempotent: running it twice changes nothing the second time. Anything it does can be undone in Admin → Catalog → Countries.
 * Needs SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { createClient } from "@supabase/supabase-js";
import launch from "../src/content/launch.json";
import { WORLD } from "../src/content/world";
import { slugify } from "../src/lib/slug";
import type { Database } from "../src/types/database";

const chunk = <T,>(rows: T[], size: number) => Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, i * size + size));

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.");
    process.exit(2);
  }
  const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const ok = <T,>(r: { data: T | null; error: { message: string } | null }, what: string): T => {
    if (r.error) throw new Error(`${what}: ${r.error.message}`);
    return r.data as T;
  };

  const locations = ok(await db.from("locations").select("id, name, slug, iso2, sort_order, is_active"), "reading locations");
  const plans = ok(await db.from("plans").select("id, product, slug, is_active"), "reading plans");
  const pricing = ok(await db.from("plan_pricing").select("plan_id, location_id, is_active"), "reading prices");
  const byIso = new Map(locations.map((l) => [l.iso2.trim().toUpperCase(), l]));
  const planFor = new Map(plans.map((p) => [`${p.product}/${p.slug}`, p]));
  const missingPlans = launch.plans.filter((p) => !planFor.has(p));
  if (missingPlans.length) throw new Error(`These plans don't exist in the database yet: ${missingPlans.join(", ")}. Run the seed first.`);

  // ---- what to do ---------------------------------------------------------------------------------------------------
  const renames = [
    { iso2: "US", from: { name: "USA", slug: "usa" }, to: { name: "United States", slug: "united-states" } },
    { iso2: "GB", from: { name: "UK", slug: "uk" }, to: { name: "United Kingdom", slug: "united-kingdom" } },
  ].filter((r) => byIso.get(r.iso2)?.slug === r.from.slug);

  const pakistan = byIso.get("PK");
  const hidePakistan = pakistan && pakistan.is_active ? pakistan : undefined;

  const taken = new Set(locations.map((l) => l.slug));
  for (const r of renames) {
    taken.delete(r.from.slug);
    taken.add(r.to.slug);
  }
  const newLocations = launch.countries
    .map(([iso2], i) => ({ iso2: iso2!, order: i + 1 }))
    .filter((c) => !byIso.has(c.iso2))
    .map((c) => {
      const name = WORLD.find((w) => w.iso2 === c.iso2)!.name;
      let slug = slugify(name);
      for (let n = 2; taken.has(slug); n++) slug = `${slugify(name)}-${n}`;
      taken.add(slug);
      return { name, slug, iso2: c.iso2, sort_order: c.order, is_active: true };
    });
  const reorder = launch.countries.flatMap(([iso2], i) => {
    const l = byIso.get(iso2!);
    return l && (l.sort_order !== i + 1 || !l.is_active) ? [{ id: l.id, sort_order: i + 1 }] : [];
  });

  // ---- prices: every launch country × every plan; keep what exists --------------------------------------------------
  const havePrice = new Map(pricing.map((p) => [`${p.plan_id}:${p.location_id}`, p.is_active]));

  console.log(apply ? "Applying the launch countries…" : "DRY RUN — nothing is written. Add --apply to make these changes.");
  console.log(`  rename:     ${renames.length ? renames.map((r) => `${r.from.name} → ${r.to.name}`).join(", ") : "nothing to rename"}`);
  console.log(`  switch off: ${hidePakistan ? "Pakistan (location and its prices hidden, nothing deleted)" : "Pakistan is already off"}`);
  console.log(`  add:        ${newLocations.length} new countries`);
  console.log(`  re-order:   ${reorder.length} existing locations`);

  let created = 0;
  let reactivated = 0;
  const idOf = new Map(locations.map((l) => [l.iso2.trim().toUpperCase(), l.id]));

  if (apply) {
    for (const r of renames) {
      ok(await db.from("locations").update({ name: r.to.name, slug: r.to.slug }).eq("id", byIso.get(r.iso2)!.id), `renaming ${r.from.name}`);
    }
    if (hidePakistan) {
      ok(await db.from("locations").update({ is_active: false }).eq("id", hidePakistan.id), "switching Pakistan off");
      ok(await db.from("plan_pricing").update({ is_active: false }).eq("location_id", hidePakistan.id), "hiding Pakistan's prices");
    }
    for (const part of chunk(newLocations, 100)) {
      const rows = ok(await db.from("locations").insert(part).select("id, iso2"), "adding countries");
      for (const row of rows) idOf.set(row.iso2.trim().toUpperCase(), row.id);
    }
    for (const r of reorder) ok(await db.from("locations").update({ sort_order: r.sort_order, is_active: true }).eq("id", r.id), "ordering countries");
  }

  const inserts: Database["public"]["Tables"]["plan_pricing"]["Insert"][] = [];
  const turnOn: string[] = [];
  for (const [iso2, tier] of launch.countries) {
    const locId = idOf.get(iso2!) ?? `new:${iso2}`; // a country that doesn't exist yet gets all its prices below
    const prices = launch.tiers[tier as "value" | "standard" | "premium"];
    launch.plans.forEach((planKey, i) => {
      const plan = planFor.get(planKey)!;
      const had = havePrice.get(`${plan.id}:${locId}`);
      if (had === undefined) {
        inserts.push({ plan_id: plan.id, location_id: locId, price_cents: prices[i]! * 100, stock: "in_stock", is_active: true });
      } else if (had === false) turnOn.push(`${plan.id}:${locId}`);
    });
  }
  const pricesToAdd = inserts.length;
  const pricesToTurnOn = turnOn.length;
  console.log(`  prices:     ${pricesToAdd} to add, ${pricesToTurnOn} existing ones to switch back on`);

  if (!apply) {
    console.log("\nNothing was changed. Run again with --apply to make these changes.");
    return;
  }
  for (const part of chunk(inserts, 300)) {
    ok(await db.from("plan_pricing").insert(part), "adding prices");
    created += part.length;
  }
  for (const pair of turnOn) {
    const [planId, locId] = pair.split(":");
    ok(await db.from("plan_pricing").update({ is_active: true }).eq("plan_id", planId!).eq("location_id", locId!), "switching prices on");
    reactivated++;
  }
  console.log(`\n✔ Done: ${newLocations.length} countries added, ${created} prices added, ${reactivated} prices switched on. The site shows the change straight away (the catalog cache lasts up to 5 minutes).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
