/**
 * Promote the FIRST admin. Run once, after that person has registered (and ideally verified their email):
 *
 *   npm run make-admin -- you@example.com
 *
 * Uses the service-role key (read from .env.local) to call `bootstrap_first_admin`, which refuses to run
 * once any admin exists. Every further role change is made by an admin inside the app and is audited.
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const email = process.argv[2]?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!email || !email.includes("@")) {
    console.error("Usage: npm run make-admin -- <email>");
    process.exit(2);
  }
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.");
    process.exit(2);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc("bootstrap_first_admin", { p_email: email });

  if (error) {
    const reason: Record<string, string> = {
      CONFLICT: "An admin already exists. Use Admin → Users to change roles.",
      NOT_FOUND: `No account found for ${email}. Register it on the site first.`,
    };
    console.error(reason[error.message] ?? `Failed: ${error.message}`);
    process.exit(1);
  }
  console.log(`✔ ${email} is now an admin (profile ${data}). Sign in and open /admin.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
