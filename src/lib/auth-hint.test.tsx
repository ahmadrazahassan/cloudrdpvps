import { createChunks, stringToBase64URL } from "@supabase/ssr";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HeaderAuthActions } from "@/components/marketing/auth-actions";
import { AUTH_HINT_SCRIPT, applyAuthHint, detectSignedIn } from "./auth-hint";

const KEY = "sb-mfpyccktkhhslhywbmps-auth-token";

const session = (extra: Record<string, unknown> = {}) => ({
  access_token: "a".repeat(900),
  token_type: "bearer",
  expires_in: 3600,
  expires_at: 1_900_000_000,
  refresh_token: "r3fr3sh",
  user: { id: "201ce73f-0d05-4a01-808c-a847e96ee02f", email: "someone@example.com", user_metadata: { full_name: "Ahmad Raza حسن 👋" }, ...extra },
});

/** The cookie string a browser would hand back for a session the way @supabase/ssr writes it (base64url, chunked when long). */
function cookiesFor(value: unknown, encoding: "base64url" | "raw" = "base64url") {
  const json = JSON.stringify(value);
  const stored = encoding === "base64url" ? `base64-${stringToBase64URL(json)}` : encodeURIComponent(json);
  return createChunks(KEY, stored)
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

describe("detectSignedIn", () => {
  it("sees a signed-in browser, whether the session cookie is one piece or several", () => {
    const small = cookiesFor({ refresh_token: "r3fr3sh", access_token: "x" });
    expect(small).not.toContain(".0=");
    expect(detectSignedIn(small)).toBe(true);

    const big = cookiesFor(session({ big: "z".repeat(6000) }));
    expect(big).toContain(`${KEY}.0=`);
    expect(big).toContain(`${KEY}.1=`);
    expect(detectSignedIn(big)).toBe(true);
  });

  it("reads the unencoded form and ignores the order and the other cookies around it", () => {
    expect(detectSignedIn(cookiesFor(session(), "raw"))).toBe(true);
    const chunks = createChunks(KEY, `base64-${stringToBase64URL(JSON.stringify(session({ big: "z".repeat(6000) })))}`);
    expect(chunks.length).toBeGreaterThan(2);
    const reversed = [...chunks].reverse().map((c) => `${c.name}=${c.value}`);
    const shuffled = ["theme=light", reversed[0], "_ga=GA1.2.3", ...reversed.slice(1)].join("; ");
    expect(detectSignedIn(shuffled)).toBe(true);
  });

  it("says no when there is no usable session", () => {
    expect(detectSignedIn("")).toBe(false);
    expect(detectSignedIn("theme=light; _ga=GA1.2.3")).toBe(false);
    expect(detectSignedIn(`${KEY}-code-verifier=abc123`)).toBe(false); // sign-in in progress, not signed in
    expect(detectSignedIn(`${KEY}=`)).toBe(false);
    expect(detectSignedIn(`${KEY}=base64-%%%not-base64`)).toBe(false);
    expect(detectSignedIn(`${KEY}=not-json`)).toBe(false);
    expect(detectSignedIn(cookiesFor({ access_token: "x" }))).toBe(false); // no refresh token
    expect(detectSignedIn(cookiesFor(null))).toBe(false);
  });
});

describe("the inline script and applyAuthHint", () => {
  const fakeDocument = (cookie: string) => {
    const attrs = new Map<string, string>();
    return {
      attrs,
      cookie,
      documentElement: { setAttribute: (k: string, v: string) => void attrs.set(k, v), removeAttribute: (k: string) => void attrs.delete(k) },
    };
  };

  it("marks <html data-auth=in> for a signed-in browser and clears it otherwise", () => {
    const signedIn = fakeDocument(cookiesFor(session()));
    new Function("document", AUTH_HINT_SCRIPT)(signedIn);
    expect(signedIn.attrs.get("data-auth")).toBe("in");

    const signedOut = fakeDocument("theme=light");
    signedOut.attrs.set("data-auth", "in");
    new Function("document", AUTH_HINT_SCRIPT)(signedOut);
    expect(signedOut.attrs.has("data-auth")).toBe(false);
  });

  it("the client sync does the same, so a link click after signing in or out stays right", () => {
    const doc = fakeDocument(cookiesFor(session()));
    applyAuthHint(doc as never);
    expect(doc.attrs.get("data-auth")).toBe("in");
    doc.cookie = "";
    applyAuthHint(doc as never);
    expect(doc.attrs.has("data-auth")).toBe(false);
  });

  it("never throws, whatever the cookie jar holds", () => {
    expect(() => new Function("document", AUTH_HINT_SCRIPT)({ cookie: undefined, documentElement: { setAttribute() {}, removeAttribute() {} } })).not.toThrow();
  });
});

describe("header buttons", () => {
  it("ship both versions in the static HTML, each tagged for the stylesheet", () => {
    const html = renderToStaticMarkup(<HeaderAuthActions />);
    expect(html).toMatch(/data-auth-show="out"[^>]*href="\/login"|href="\/login"[^>]*data-auth-show="out"/);
    expect(html).toMatch(/data-auth-show="out"[^>]*href="\/#pricing"|href="\/#pricing"[^>]*data-auth-show="out"/);
    expect(html).toMatch(/data-auth-show="in"[^>]*href="\/dashboard"|href="\/dashboard"[^>]*data-auth-show="in"/);
    expect(html).toContain("Log in");
    expect(html).toContain("Get started");
    expect(html).toContain("Dashboard");
  });
});
