import { describe, expect, it } from "vitest";
import { fromAuthError } from "./errors";

describe("fromAuthError", () => {
  it("never distinguishes 'no such user' from 'wrong password'", () => {
    expect(fromAuthError({ code: "invalid_credentials" }).code).toBe("INVALID_CREDENTIALS");
    expect(fromAuthError({ code: "user_not_found" }).code).toBe("INVALID_CREDENTIALS");
    expect(fromAuthError({ code: "invalid_credentials" }).message).toBe("Incorrect email or password.");
  });

  it("maps the account-state and link errors", () => {
    expect(fromAuthError({ code: "email_not_confirmed" }).code).toBe("EMAIL_NOT_CONFIRMED");
    expect(fromAuthError({ code: "user_banned" }).code).toBe("ACCOUNT_SUSPENDED");
    for (const code of ["otp_expired", "flow_state_expired", "bad_code_verifier"]) {
      expect(fromAuthError({ code }).code).toBe("LINK_INVALID");
    }
    expect(fromAuthError({ code: "session_not_found" }).code).toBe("UNAUTHENTICATED");
  });

  it("turns password problems into field errors on the password field", () => {
    const weak = fromAuthError({ code: "weak_password" });
    expect(weak.code).toBe("VALIDATION");
    expect(weak.fieldErrors?.password?.[0]).toMatch(/stronger/i);
    expect(fromAuthError({ code: "same_password" }).fieldErrors?.password).toBeDefined();
  });

  it("maps Supabase's rate limits to RATE_LIMITED", () => {
    for (const code of ["over_request_rate_limit", "over_email_send_rate_limit"]) {
      expect(fromAuthError({ code }).code).toBe("RATE_LIMITED");
    }
  });

  it("hides anything unrecognised behind INTERNAL and never echoes the raw message", () => {
    const e = fromAuthError({ code: "weird", message: "db host 10.0.0.5 exploded" });
    expect(e.code).toBe("INTERNAL");
    expect(e.message).not.toContain("10.0.0.5");
  });
});
