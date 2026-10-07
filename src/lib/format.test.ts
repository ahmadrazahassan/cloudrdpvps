import { describe, expect, it } from "vitest";
import { countdown, countryName, daysUntil, firstName, formatDate, formatDateTime, greeting, plural, relativeTime, specLine } from "./format";

const NOW = Date.UTC(2026, 9, 4, 12, 0, 0); // 4 Oct 2026, 12:00 UTC

describe("dates", () => {
  it("formats dates and times in UTC", () => {
    expect(formatDate("2026-11-12T23:30:00Z")).toBe("12 Nov 2026");
    expect(formatDateTime("2026-11-12T14:05:00Z")).toBe("12 Nov 2026 14:05");
  });

  it("counts whole days up", () => {
    expect(daysUntil(NOW + 21 * 86_400_000, NOW)).toBe(21);
    expect(daysUntil(NOW + 20.2 * 86_400_000, NOW)).toBe(21);
    expect(daysUntil(NOW - 3_600_000, NOW)).toBe(0);
    expect(daysUntil(NOW - 2 * 86_400_000, NOW)).toBe(-2);
  });

  it("describes relative times", () => {
    expect(relativeTime(NOW - 20_000, NOW)).toBe("just now");
    expect(relativeTime(NOW - 3 * 3_600_000, NOW)).toBe("3 hours ago");
    expect(relativeTime(NOW + 2 * 86_400_000, NOW)).toBe("in 2 days");
    expect(relativeTime(NOW - 86_400_000, NOW)).toBe("yesterday");
    expect(relativeTime(NOW - 90 * 86_400_000, NOW)).toBe(formatDate(NOW - 90 * 86_400_000));
  });

  it("counts down to a payment deadline", () => {
    expect(countdown(NOW + (47 * 60 + 12) * 60_000, NOW)).toBe("47h 12m");
    expect(countdown(NOW + 5 * 60_000, NOW)).toBe("5m");
    expect(countdown(NOW + 3 * 3_600_000 + 4 * 60_000, NOW)).toBe("3h 04m");
    expect(countdown(NOW - 1, NOW)).toBe("Expired");
  });
});

describe("text helpers", () => {
  it("pluralises", () => {
    expect(plural(1, "server")).toBe("1 server");
    expect(plural(0, "server")).toBe("0 servers");
    expect(plural(2, "reply", "replies")).toBe("2 replies");
  });

  it("picks a first name, falling back to the email", () => {
    expect(firstName("Aisha Khan", "a@x.com")).toBe("Aisha");
    expect(firstName("  ", "sam.lee@x.com")).toBe("sam.lee");
    expect(firstName(null, "z@x.com")).toBe("z");
  });

  it("greets by hour", () => {
    expect(greeting(6)).toBe("Good morning");
    expect(greeting(12)).toBe("Good afternoon");
    expect(greeting(18)).toBe("Good evening");
  });

  it("summarises a plan snapshot", () => {
    expect(specLine({ vcpu: 4, ram_gb: 8, storage_gb: 120 })).toBe("4 vCPU · 8 GB RAM · 120 GB NVMe");
    expect(specLine(null)).toBe("");
    expect(specLine({ vcpu: 2 })).toBe("2 vCPU");
  });

  it("names a country from its code, and copes with junk", () => {
    expect(countryName("PK")).toBe("Pakistan");
    expect(countryName(" us ")).toBe("United States");
    expect(countryName("")).toBeNull();
    expect(countryName(null)).toBeNull();
    expect(countryName("not-a-code")).toBe("NOT-A-CODE");
  });
});
