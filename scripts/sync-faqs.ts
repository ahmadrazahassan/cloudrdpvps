/**
 * Load the site's built-in FAQ answers (src/content/faqs.ts) into the `faqs` table, so they can be edited in
 * Admin → Content → FAQs and the public site reads them from the database.
 *
 *   npm run faqs:sync
 *
 * Idempotent: adds missing questions, replaces only the original seeded placeholders (category "general"),
 * and never touches anything an admin has edited. Needs SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { createClient } from "@supabase/supabase-js";
import { syncBuiltinFaqs } from "../src/lib/faqs-sync";
import type { Database } from "../src/types/database";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.");
    process.exit(2);
  }
  const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { added, updated } = await syncBuiltinFaqs(client);
  console.log(`✔ FAQs synced: ${added} added, ${updated} placeholder answers replaced.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
