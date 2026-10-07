import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { serverEnv } from "@/lib/env.server";

export type Window = `${number} ${"s" | "m" | "h" | "d"}`;

export interface RateResult {
  ok: boolean;
  remaining: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
}

const UNIT_MS = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

export function windowToMs(window: Window): number {
  const [n, unit] = window.split(" ") as [string, keyof typeof UNIT_MS];
  return Number(n) * UNIT_MS[unit];
}

// ---------------------------------------------------------------------------
// In-memory fixed window: used when Upstash isn't configured (local dev, a
// single self-hosted instance). It is per-process, so on a multi-instance
// deployment configure Upstash for a shared limit.
// ---------------------------------------------------------------------------
const buckets = new Map<string, { count: number; resetAt: number }>();

export function memoryLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateResult {
  if (buckets.size > 5_000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  current.count += 1;
  return { ok: current.count <= limit, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt };
}

export function resetMemoryLimiterForTests() {
  buckets.clear();
}

// ---------------------------------------------------------------------------
let redis: Redis | null | undefined;
const limiters = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const env = serverEnv();
  redis =
    env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
      ? new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
      : null;
  return redis;
}

export interface RateLimitOptions {
  /** Which protected operation this is, e.g. "login". Part of the key. */
  name: string;
  /** Who is being limited: a user id, an IP, or "ip:user". */
  id: string;
  limit: number;
  window: Window;
}

/**
 * Throttle an operation. Fails OPEN if the limiter backend is unreachable, so
 * a Redis outage can't lock customers out; the database and Supabase Auth keep
 * their own limits behind this one.
 */
export async function rateLimit({ name, id, limit, window }: RateLimitOptions): Promise<RateResult> {
  const r = getRedis();
  if (!r) return memoryLimit(`${name}:${id}`, limit, windowToMs(window));

  try {
    const cacheKey = `${name}:${limit}:${window}`;
    let limiter = limiters.get(cacheKey);
    if (!limiter) {
      limiter = new Ratelimit({
        redis: r,
        limiter: Ratelimit.slidingWindow(limit, window),
        prefix: `crv:rl:${name}`,
        analytics: false,
      });
      limiters.set(cacheKey, limiter);
    }
    const res = await limiter.limit(id);
    return { ok: res.success, remaining: res.remaining, resetAt: res.reset };
  } catch (error) {
    console.error(`[rate-limit:${name}] backend unavailable, allowing request`, error);
    return { ok: true, remaining: limit, resetAt: Date.now() + windowToMs(window) };
  }
}
