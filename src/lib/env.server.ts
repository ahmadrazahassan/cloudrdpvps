import "server-only";
import { z } from "zod";

/**
 * Server-only secrets, validated lazily so `next build` and unit tests don't
 * need every key. A feature that needs a missing key fails loudly, by name,
 * at the moment it is used — never silently.
 */
const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  /** `kid:base64key,kid2:base64key` — the FIRST entry encrypts, all entries decrypt (rotation). */
  CREDENTIAL_KEYS: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(24).optional(),
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).optional(),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const raw: Record<string, string | undefined> = {};
  for (const key of Object.keys(schema.shape)) {
    const v = process.env[key];
    raw[key] = v && v.trim() !== "" ? v.trim() : undefined;
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      "Invalid server environment configuration:\n" +
        parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n"),
    );
  }
  cached = parsed.data;
  return cached;
}

export function requireServerEnv<K extends keyof ServerEnv>(key: K): NonNullable<ServerEnv[K]> {
  const value = serverEnv()[key];
  if (value === undefined) {
    throw new Error(`Missing required environment variable ${String(key)} (see .env.example).`);
  }
  return value as NonNullable<ServerEnv[K]>;
}

/** Test hook: forget the memoised parse after changing process.env. */
export function resetServerEnvForTests() {
  cached = undefined;
}
