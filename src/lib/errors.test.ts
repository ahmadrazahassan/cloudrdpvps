import { describe, expect, it } from "vitest";
import { AppError, ERROR_CODES, ERROR_MESSAGES, check, fromDbError, isErrorCode, unwrap } from "./errors";
import { loginUrl, safeNext } from "./redirect";

describe("database error mapping", () => {
  it("every code has customer-safe copy", () => {
    for (const c of ERROR_CODES) expect(ERROR_MESSAGES[c].length).toBeGreaterThan(5);
  });

  it("maps our domain exceptions (P0001) to their code", () => {
    expect(fromDbError({ code: "P0001", message: "OUT_OF_STOCK" }).code).toBe("OUT_OF_STOCK");
    expect(fromDbError({ code: "P0001", message: "REASON_REQUIRED" }).code).toBe("REASON_REQUIRED");
  });

  it("does not trust arbitrary P0001 text", () => {
    const e = fromDbError({ code: "P0001", message: "something with secret internals" });
    expect(e.code).toBe("INTERNAL");
    expect(e.message).toBe(ERROR_MESSAGES.INTERNAL);
    expect(e.message).not.toContain("secret");
  });

  it("maps Postgres/PostgREST classes", () => {
    expect(fromDbError({ code: "42501", message: "permission denied for table x" }).code).toBe("FORBIDDEN");
    expect(fromDbError({ code: "23505" }).code).toBe("CONFLICT");
    for (const code of ["23514", "23502", "23503", "22P02", "22001"]) expect(fromDbError({ code }).code).toBe("VALIDATION");
    expect(fromDbError({ code: "PGRST116" }).code).toBe("NOT_FOUND");
    expect(fromDbError({ code: "PGRST301" }).code).toBe("UNAUTHENTICATED");
    expect(fromDbError({ code: "XX000", message: "boom" }).code).toBe("INTERNAL");
  });

  it("unwrap / check throw AppErrors and keep the raw cause out of the message", () => {
    expect(unwrap({ data: 5, error: null })).toBe(5);
    expect(() => unwrap({ data: null, error: null })).toThrow(AppError);
    expect(() => unwrap({ data: null, error: { code: "P0001", message: "COUPON_INVALID" } })).toThrow(/coupon/i);
    expect(() => check({ error: { code: "23505" } })).toThrow(AppError);
    expect(() => check({ error: null })).not.toThrow();
    expect(isErrorCode("NOT_FOUND")).toBe(true);
    expect(isErrorCode("nope")).toBe(false);
  });

  it("matches every code the SQL can raise", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const dir = path.resolve(__dirname, "..", "..", "supabase", "migrations");
    const raised = new Set<string>();
    for (const f of readdirSync(dir)) {
      const sql = readFileSync(path.join(dir, f), "utf8");
      for (const m of sql.matchAll(/(?:fail\(|message\s*=\s*)'([A-Z_]{4,})'/g)) raised.add(m[1]!);
    }
    expect(raised.size).toBeGreaterThan(15);
    for (const code of raised) expect(isErrorCode(code), `${code} is raised by SQL but missing from ERROR_CODES`).toBe(true);
  });
});

describe("safeNext (open-redirect guard)", () => {
  it("keeps same-site paths, queries and hashes", () => {
    expect(safeNext("/dashboard/orders")).toBe("/dashboard/orders");
    expect(safeNext("/order/new?plan=pro&loc=usa")).toBe("/order/new?plan=pro&loc=usa");
    expect(safeNext("/a#frag")).toBe("/a#frag");
  });

  it("rejects anything that could leave the site", () => {
    for (const bad of [
      "https://evil.test", "//evil.test", "/\\evil.test", "\\\\evil.test", "javascript:alert(1)", "/\t/evil.test",
      "/\n/evil.test", "evil.test", "", "http://localhost:3000/x", "/%0d%0aSet-Cookie:x=y".replace("%0d%0a", "\r\n"),
    ]) {
      expect(safeNext(bad), JSON.stringify(bad)).toBe("/dashboard");
    }
    expect(safeNext(undefined)).toBe("/dashboard");
    expect(safeNext(42)).toBe("/dashboard");
    expect(safeNext("x".repeat(600))).toBe("/dashboard");
    expect(safeNext("https://evil.test", "/")).toBe("/");
  });

  it("builds login URLs", () => {
    expect(loginUrl()).toBe("/login");
    expect(loginUrl("/")).toBe("/login");
    expect(loginUrl("/dashboard/orders?x=1")).toBe("/login?next=%2Fdashboard%2Forders%3Fx%3D1");
  });
});
