import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import { csvCell, toCsv, cleanSearch } from "./pure";
import { generatePassword } from "./generate-password";
import { centsToInput, parseUsdToCents, percentChange } from "./money";
import { buildReport } from "./reports";

describe("parseUsdToCents", () => {
  it("reads plain amounts into integer cents", () => {
    expect(parseUsdToCents("25")).toBe(2500);
    expect(parseUsdToCents("25.5")).toBe(2550);
    expect(parseUsdToCents("25.05")).toBe(2505);
    expect(parseUsdToCents("$1,250.00")).toBe(125000);
    expect(parseUsdToCents("0.01")).toBe(1);
  });
  it("rejects anything that isn't a plain amount", () => {
    for (const bad of ["", "abc", "-5", "1.234", "1e3", "12,50.5.5", "NaN", "9999999999"]) expect(parseUsdToCents(bad)).toBeNull();
  });
  it("round-trips through the input formatter", () => {
    expect(centsToInput(125050)).toBe("1250.50");
    expect(parseUsdToCents(centsToInput(1999))).toBe(1999);
  });
});

describe("percentChange", () => {
  it("compares to the previous period", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(5, 0)).toBeNull(); // nothing to compare against
  });
});

describe("generatePassword", () => {
  it("makes 20 characters with every character class", () => {
    for (let i = 0; i < 50; i++) {
      const p = generatePassword();
      expect(p).toHaveLength(20);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/\d/);
      expect(p).toMatch(/[!@#$%^&*\-_=+]/);
      expect(p).not.toMatch(/[lIO01]/); // no look-alikes
    }
  });
  it("is not repeatable", () => {
    expect(new Set(Array.from({ length: 30 }, () => generatePassword())).size).toBe(30);
  });
});

describe("parseCsv", () => {
  it("handles quotes, commas inside quotes, CRLF and blank lines", () => {
    const rows = parseCsv('product,note\r\nrdp,"hello, ""world"""\r\n\r\nvps,plain\n');
    expect(rows).toEqual([
      ["product", "note"],
      ["rdp", 'hello, "world"'],
      ["vps", "plain"],
    ]);
  });
  it("keeps a trailing cell with no newline", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("csv output", () => {
  it("quotes cells and neutralises spreadsheet formulas", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell(null)).toBe("");
    expect(toCsv(["a", "b"], [[1, "x,y"]])).toBe('a,b\r\n1,"x,y"\r\n');
  });
});

describe("cleanSearch", () => {
  it("removes characters that mean something inside a PostgREST filter", () => {
    expect(cleanSearch("a,b(c)*%\\\"'`;:d")).toBe("a b c d");
    expect(cleanSearch("  spaced   out  ")).toBe("spaced out");
    expect(cleanSearch(undefined)).toBe("");
    expect(cleanSearch("x".repeat(200))).toHaveLength(64);
  });
});

describe("buildReport", () => {
  const order = (id: string, over: Partial<Parameters<typeof buildReport>[0]["orders"][number]> = {}) => ({
    id,
    order_number: `CRV-${id}`,
    product: "rdp" as const,
    plan_name: "Starter",
    location_name: "Pakistan",
    type: "new" as const,
    status: "completed",
    total_cents: 2000,
    discount_cents: 0,
    created_at: "2026-01-01T00:00:00Z",
    completed_at: "2026-01-02T00:00:00Z",
    ...over,
  });
  it("counts revenue from paid invoices only, net of refunds", () => {
    const r = buildReport({
      orders: [order("1"), order("2", { product: "vps", plan_name: "Pro", type: "renewal", total_cents: 4000 }), order("3", { status: "awaiting_payment", completed_at: null })],
      invoices: [
        { id: "i1", order_id: "1", total_cents: 1800, discount_cents: 200, status: "paid", issued_at: "" },
        { id: "i2", order_id: "2", total_cents: 4000, discount_cents: 0, status: "paid", issued_at: "" },
        { id: "i3", order_id: "3", total_cents: 999, discount_cents: 0, status: "void", issued_at: "" },
      ],
      payments: [
        { order_id: "1", method_name: "Bank", status: "verified", amount_usd_cents: 1800 },
        { order_id: "2", method_name: "Wise", status: "verified", amount_usd_cents: 4000 },
        { order_id: "3", method_name: "Bank", status: "pending", amount_usd_cents: 2000 },
      ],
      refunds: [{ order_id: "2", data: { amount_cents: 500 } }],
      newCustomers: 3,
      tickets: [{ id: "t", created_at: "", last_staff_message_at: "x" }, { id: "u", created_at: "", last_staff_message_at: null }],
    });
    expect(r.grossCents).toBe(6000); // 5800 paid + 200 discount
    expect(r.discountCents).toBe(200);
    expect(r.refundCents).toBe(500);
    expect(r.netCents).toBe(5300);
    expect(r.paidInvoices).toBe(2);
    expect(r.byProduct.map((x) => [x.label, x.cents])).toEqual([["VPS", 4000], ["RDP", 1800]]);
    expect(r.newVsRenewal.find((x) => x.label === "Renewals")?.count).toBe(1);
    expect(r.byMethod.map((x) => x.label)).toEqual(["Wise", "Bank"]); // the pending proof isn't revenue
    expect(r.funnel.map((f) => f.count)).toEqual([3, 3, 2, 1]); // delivered counts completed NEW orders only (order 2 is a renewal)
    expect(r.tickets).toEqual({ opened: 2, answered: 1 });
  });
});
