/**
 * Date and count formatting shared by the portal and admin screens.
 * Server-rendered dates use UTC so the HTML is identical for everyone; the
 * <LocalTime> client component swaps in the visitor's own locale and time zone.
 */

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const toDate = (v: string | number | Date) => (v instanceof Date ? v : new Date(v));

/** 12 Nov 2026 */
export const formatDate = (v: string | number | Date) => dateFmt.format(toDate(v));

/** 12 Nov 2026, 14:05 (UTC) */
export const formatDateTime = (v: string | number | Date) => dateTimeFmt.format(toDate(v)).replace(",", "");

const MS = { minute: 60_000, hour: 3_600_000, day: 86_400_000 } as const;

/** Whole days from `now` until `to` (negative once passed), rounded up like a countdown. */
export function daysUntil(to: string | number | Date, now: number = Date.now()): number {
  const days = Math.ceil((toDate(to).getTime() - now) / MS.day);
  return days === 0 ? 0 : days; // Math.ceil of a tiny negative number is -0, which would print as "-0"
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 hours ago", "in 2 days", "yesterday" */
export function relativeTime(v: string | number | Date, now: number = Date.now()): string {
  const diff = toDate(v).getTime() - now;
  const abs = Math.abs(diff);
  if (abs < MS.minute) return "just now";
  if (abs < MS.hour) return rtf.format(Math.round(diff / MS.minute), "minute");
  if (abs < MS.day) return rtf.format(Math.round(diff / MS.hour), "hour");
  if (abs < 30 * MS.day) return rtf.format(Math.round(diff / MS.day), "day");
  return formatDate(v);
}

/** "47h 12m" (or "Expired") for a payment deadline. */
export function countdown(to: string | number | Date, now: number = Date.now()): string {
  const ms = toDate(to).getTime() - now;
  if (ms <= 0) return "Expired";
  const totalMin = Math.floor(ms / MS.minute);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** "1 server", "3 servers" */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** First name for greetings; falls back to the part of the email before "@". */
export function firstName(fullName: string | null | undefined, email: string): string {
  const name = fullName?.trim().split(/\s+/)[0];
  return name || email.split("@")[0] || "there";
}

/** "good morning" etc. from an hour (0–23) — the caller supplies the user's local hour. */
export function greeting(hour: number): "Good morning" | "Good afternoon" | "Good evening" {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

/** "Pakistan" from "PK". Falls back to the code itself, and to null when there is none. */
export function countryName(code: string | null | undefined): string | null {
  const c = code?.trim().toUpperCase();
  if (!c) return null;
  try {
    return regionNames.of(c) ?? c;
  } catch {
    return c;
  }
}

/** "4 vCPU · 8 GB RAM · 120 GB NVMe" from an order/service plan_specs snapshot. */
export function specLine(specs: unknown): string {
  const s = (specs ?? {}) as Record<string, unknown>;
  const parts = [
    typeof s.vcpu === "number" ? `${s.vcpu} vCPU` : null,
    typeof s.ram_gb === "number" ? `${s.ram_gb} GB RAM` : null,
    typeof s.storage_gb === "number" ? `${s.storage_gb} GB NVMe` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}
