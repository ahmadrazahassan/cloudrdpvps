/**
 * Which payment methods have a brand logo. Matching is by the method's name (the owner names them in
 * Admin → Payment methods), so "JazzCash", "Jazzcash" and "Jazz Cash" are all the same brand.
 * Pure — shared by server pages, the checkout flow and the tests.
 */

export type PaymentBrand = "jazzcash" | "easypaisa" | "meezan" | "binance";

const MATCHERS: readonly [PaymentBrand, RegExp][] = [
  ["jazzcash", /jazz[\s-]*cash/i],
  ["easypaisa", /easy[\s-]*paisa/i],
  ["meezan", /meezan/i],
  ["binance", /binance/i],
];

/**
 * The logo files that live in /public/payments. A brand is listed here only once its file is there, so a
 * method never points at a missing image — a method without one shows the neutral icon for its type.
 * Every logo is a square symbol (the method's name is always written beside it). The PNGs are built from the
 * official files in scripts/payment-logos-src by `npm run payments:build`; Binance is a hand-drawn SVG.
 * To add a brand: drop its official logo in scripts/payment-logos-src, add it to the build script, add a line here.
 * `height` is the height it is drawn at, in px; width follows.
 */
export const PAYMENT_LOGOS: Partial<Record<PaymentBrand, { src: string; height: number }>> = {
  jazzcash: { src: "/payments/jazzcash.png", height: 28 },
  easypaisa: { src: "/payments/easypaisa.png", height: 28 },
  meezan: { src: "/payments/meezan.png", height: 28 },
  binance: { src: "/payments/binance.svg", height: 28 },
};

export function paymentBrand(name: string): PaymentBrand | null {
  return MATCHERS.find(([, re]) => re.test(name))?.[0] ?? null;
}

/** The logo for a method name, or null when it has none (yet). */
export function paymentLogo(name: string): { brand: PaymentBrand; src: string; height: number } | null {
  const brand = paymentBrand(name);
  const logo = brand ? PAYMENT_LOGOS[brand] : undefined;
  return brand && logo ? { brand, ...logo } : null;
}
