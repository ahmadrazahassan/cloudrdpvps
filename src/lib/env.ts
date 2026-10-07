/**
 * Public (browser-safe) configuration. Only NEXT_PUBLIC_* values live here.
 * Next.js inlines these at build time, so each one must be read with a static
 * `process.env.NEXT_PUBLIC_X` access — never through a loop or a variable.
 */
import { z } from "zod";

const schema = z.object({
  siteUrl: z.url(),
  supabaseUrl: z.url().optional(),
  supabaseAnonKey: z.string().min(20).optional(),
  turnstileSiteKey: z.string().min(1).optional(),
});

const blank = (v: string | undefined) => (v && v.trim() !== "" ? v.trim() : undefined);

const parsed = schema.safeParse({
  siteUrl: blank(process.env.NEXT_PUBLIC_SITE_URL) ?? "http://localhost:3000",
  supabaseUrl: blank(process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: blank(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  turnstileSiteKey: blank(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
});

if (!parsed.success) {
  throw new Error(
    "Invalid public environment configuration:\n" +
      parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n"),
  );
}

export const publicEnv = {
  ...parsed.data,
  siteUrl: parsed.data.siteUrl.replace(/\/+$/, ""),
};

/** True once both Supabase values are present (the site falls back to seed data otherwise). */
export const isSupabaseConfigured = Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);

export function requireSupabasePublic() {
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).",
    );
  }
  return { url: publicEnv.supabaseUrl, anonKey: publicEnv.supabaseAnonKey };
}
