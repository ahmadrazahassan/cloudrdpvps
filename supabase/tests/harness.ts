/**
 * Test harness: an in-process PostgreSQL (PGlite) that mimics the parts of
 * Supabase our migrations rely on — roles, the `auth` and `storage` schemas,
 * `auth.uid()`, and Supabase's habit of auto-granting privileges on new tables.
 * Migrations + seed are applied exactly as written; nothing is stubbed in them.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");

const SUPABASE_SHIM = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create schema storage;
  create schema extensions;

  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth   to anon, authenticated, service_role;
  grant usage on schema storage to anon, authenticated, service_role;

  -- Supabase auto-grants broad privileges on new public objects; replicate it so
  -- the migrations' own REVOKEs are what's actually being tested.
  alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    email_confirmed_at timestamptz,
    created_at timestamptz not null default now()
  );

  create function auth.uid() returns uuid language sql stable as $$
    select nullif(
      coalesce(
        current_setting('request.jwt.claim.sub', true),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
      ), '')::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  create table storage.buckets (
    id text primary key, name text, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text, owner uuid, created_at timestamptz default now()
  );
  alter table storage.objects enable row level security;
  grant select, insert, update, delete on storage.objects, storage.buckets to authenticated, service_role;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  grant execute on function storage.foldername(text) to anon, authenticated, service_role;

  create publication supabase_realtime;
`;

export type Db = PGlite;
export type Actor =
  | { kind: "anon" }
  | { kind: "service" }
  | { kind: "user"; id: string };

export async function createDb(opts: { seed?: boolean } = {}): Promise<Db> {
  const db = new PGlite();
  await db.exec(SUPABASE_SHIM);
  const dir = path.join(root, "migrations");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
    try {
      await db.exec(readFileSync(path.join(dir, f), "utf8"));
    } catch (e) {
      throw new Error(`migration ${f} failed: ${(e as Error).message}`);
    }
  }
  if (opts.seed !== false) {
    await db.exec(readFileSync(path.join(root, "seed.sql"), "utf8"));
  }
  return db;
}

/** Run `fn` as a given Supabase role / JWT, then restore the superuser session. */
export async function as<T>(db: Db, actor: Actor, fn: () => Promise<T>): Promise<T> {
  const role = actor.kind === "anon" ? "anon" : actor.kind === "service" ? "service_role" : "authenticated";
  const claims =
    actor.kind === "user"
      ? JSON.stringify({ sub: actor.id, role: "authenticated" })
      : JSON.stringify({ role });
  await db.query("select set_config('request.jwt.claims', $1, false)", [claims]);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [actor.kind === "user" ? actor.id : ""]);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims', '', false)");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

/** Expect a SQL error whose message contains `code` (our domain codes) or any text. */
export async function expectError(p: Promise<unknown>, contains: string | RegExp) {
  try {
    await p;
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    const ok = typeof contains === "string" ? msg.includes(contains) : contains.test(msg);
    if (!ok) throw new Error(`expected error matching ${contains} but got: ${msg}`);
    return msg;
  }
  throw new Error(`expected an error matching ${contains} but the call succeeded`);
}

let seq = 0;
/** Create an auth user (the trigger creates the profile). Verified by default. */
export async function createUser(
  db: Db,
  opts: { email?: string; name?: string; verified?: boolean; role?: "customer" | "support" | "admin" } = {},
): Promise<string> {
  seq += 1;
  const email = opts.email ?? `user${seq}@example.test`;
  const res = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data, email_confirmed_at)
     values ($1, $2::jsonb, ${opts.verified === false ? "null" : "now()"}) returning id`,
    [email, JSON.stringify({ full_name: opts.name ?? `User ${seq}` })],
  );
  const id = res.rows[0]!.id;
  if (opts.role && opts.role !== "customer") await setRole(db, id, opts.role);
  return id;
}

/** Superuser-only helper that raises the profile-guard bypass flag. */
export async function setRole(db: Db, id: string, role: "customer" | "support" | "admin") {
  await db.exec("select set_config('app.bypass_profile_guard', 'on', false)");
  await db.query("update public.profiles set role = $2 where id = $1", [id, role]);
  await db.exec("select set_config('app.bypass_profile_guard', 'off', false)");
}

export async function planAndLocation(db: Db, product = "rdp", planSlug = "standard", locSlug = "india") {
  const r = await db.query<{ plan_id: string; location_id: string; price_cents: number }>(
    `select p.id as plan_id, l.id as location_id, pp.price_cents
       from public.plans p
       join public.locations l on l.slug = $3
       join public.plan_pricing pp on pp.plan_id = p.id and pp.location_id = l.id
      where p.product = $1::public.product_type and p.slug = $2`,
    [product, planSlug, locSlug],
  );
  return r.rows[0]!;
}

export const sha = (c = "a") => c.repeat(64);
