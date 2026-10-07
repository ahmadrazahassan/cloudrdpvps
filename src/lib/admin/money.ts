/**
 * Money entered by staff. Amounts are typed as dollars ("1,250.50") and turned into integer cents
 * once, here, so nothing downstream ever does floating-point money math.
 */

/** "25", "25.5", "$25.50", "1,250.00" → cents. Returns null for anything that isn't a plain amount. */
export function parseUsdToCents(input: string): number | null {
  const s = input.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents <= 2_000_000_000 ? cents : null;
}

/** 125050 → "1250.50" (for pre-filling an input). */
export const centsToInput = (cents: number) => (cents / 100).toFixed(2);

/** Percentage change of `current` over `previous`; null when there is nothing to compare against. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}
