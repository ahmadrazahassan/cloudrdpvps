import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PAYMENT_LOGOS, paymentBrand, paymentLogo } from "./payment-brands";

describe("paymentBrand", () => {
  it("recognises the brands however the owner spells the method name", () => {
    expect(paymentBrand("JazzCash")).toBe("jazzcash");
    expect(paymentBrand("Jazz Cash (mobile account)")).toBe("jazzcash");
    expect(paymentBrand("EASYPAISA")).toBe("easypaisa");
    expect(paymentBrand("Easy-Paisa")).toBe("easypaisa");
    expect(paymentBrand("Meezan Bank")).toBe("meezan");
    expect(paymentBrand("Binance Pay")).toBe("binance");
  });

  it("leaves everything else without a brand", () => {
    for (const name of ["Bank transfer (Pakistan)", "UPI", "bKash", "USDT (TRC20)", "Wise", ""]) expect(paymentBrand(name)).toBeNull();
  });
});

describe("paymentLogo", () => {
  it("only ever points at a file that exists in /public (a brand without its file shows the type icon)", () => {
    for (const [brand, logo] of Object.entries(PAYMENT_LOGOS)) {
      expect(existsSync(path.join(process.cwd(), "public", logo!.src)), `${brand} → ${logo!.src}`).toBe(true);
    }
  });

  it("returns the logo for a brand that has one, and null for one that doesn't", () => {
    expect(paymentLogo("Binance Pay")).toMatchObject({ brand: "binance", src: "/payments/binance.svg" });
    expect(paymentLogo("Meezan Bank")).toMatchObject({ brand: "meezan", src: "/payments/meezan.png" });
    expect(paymentLogo("Wise")).toBeNull();
  });

  it("every method we accept has its real logo", () => {
    for (const name of ["Meezan Bank", "JazzCash", "Easypaisa", "Binance Pay"]) {
      expect(paymentLogo(name), name).not.toBeNull();
    }
  });

  it("the built PNG marks are small transparent squares, not the oversized originals", async () => {
    const { createRequire } = await import("node:module");
    const sharp = createRequire(path.join(process.cwd(), "package.json"))("sharp");
    for (const brand of ["jazzcash", "easypaisa", "meezan"] as const) {
      const file = path.join(process.cwd(), "public", PAYMENT_LOGOS[brand]!.src);
      const meta = await sharp(file).metadata();
      expect({ brand, w: meta.width, h: meta.height, alpha: meta.hasAlpha }).toEqual({ brand, w: 192, h: 192, alpha: true });
      expect(statSync(file).size, `${brand} stays light`).toBeLessThan(30 * 1024);
    }
  });
});
