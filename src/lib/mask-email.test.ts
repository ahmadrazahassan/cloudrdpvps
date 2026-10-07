import { describe, expect, it } from "vitest";
import { maskEmail } from "./mask-email";

describe("maskEmail", () => {
  it("keeps the first letter and the domain, hides the rest", () => {
    expect(maskEmail("jane.doe@gmail.com")).toBe("j••••••@gmail.com");
    expect(maskEmail("ab@example.com")).toBe("a••@example.com");
    expect(maskEmail("a@x.io")).toBe("a••@x.io");
  });
  it("never reveals the length of a long local part", () => {
    // both long local parts mask to the same width, so the length of the real address isn't leaked
    expect(maskEmail("a-really-really-long-name@x.io")).toBe("a••••••@x.io");
    expect(maskEmail("another-very-long-address@x.io")).toBe("a••••••@x.io");
  });
  it("falls back safely on junk", () => {
    expect(maskEmail("")).toBe("your email");
    expect(maskEmail("no-at-sign")).toBe("your email");
    expect(maskEmail("@nolocal.com")).toBe("your email");
  });
});
