/**
 * "Is this browser signed in?" for the public pages — answered in the browser, without touching the server.
 *
 * The marketing pages are static and shared by every visitor, so the header can't ask the server who is looking
 * (that would make every page render per request). Supabase keeps the session in a cookie the browser can read
 * (`sb-<project>-auth-token`, split into `.0`, `.1`… when long, `base64-` + base64url of the session JSON). If that
 * cookie holds a session with a refresh token, the visitor is signed in and the header offers "Dashboard" instead of
 * "Log in / Get started".
 *
 * This is only a display hint. Nothing private is shown or unlocked by it: /dashboard and /admin still check the
 * real session on the server, and a stale cookie just means "Dashboard" sends the visitor to the login page.
 */

/**
 * Self-contained on purpose (no outside references, no helpers): its source is also written into an inline script that
 * runs before the page paints, so the right buttons show on the first frame instead of flashing.
 */
export function detectSignedIn(cookieString: string): boolean {
  const chunks: { n: number; v: string }[] = [];
  const parts = cookieString ? cookieString.split(";") : [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!.replace(/^\s+/, "");
    const eq = part.indexOf("=");
    if (eq < 1) continue;
    const m = /^sb-.+-auth-token(?:\.(\d+))?$/.exec(part.slice(0, eq));
    if (m) chunks.push({ n: m[1] ? Number(m[1]) : 0, v: part.slice(eq + 1) });
  }
  if (chunks.length === 0) return false;
  chunks.sort((a, b) => a.n - b.n);
  try {
    let raw = chunks.map((c) => c.v).join("");
    try {
      raw = decodeURIComponent(raw);
    } catch {
      /* already plain */
    }
    if (raw.indexOf("base64-") === 0) {
      let b64 = raw.slice(7).replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      const bin = atob(b64);
      let pct = "";
      for (let j = 0; j < bin.length; j++) pct += "%" + ("00" + bin.charCodeAt(j).toString(16)).slice(-2);
      raw = decodeURIComponent(pct);
    }
    const session = JSON.parse(raw) as { refresh_token?: unknown } | null;
    return Boolean(session && typeof session.refresh_token === "string" && session.refresh_token);
  } catch {
    return false;
  }
}

/** The attribute on <html> that the stylesheet reads: `data-auth="in"` while signed in, absent otherwise. */
export const AUTH_ATTRIBUTE = "data-auth";

/** Sets or clears the attribute for the current cookies. */
export function applyAuthHint(doc: Pick<Document, "cookie" | "documentElement">) {
  if (detectSignedIn(doc.cookie)) doc.documentElement.setAttribute(AUTH_ATTRIBUTE, "in");
  else doc.documentElement.removeAttribute(AUTH_ATTRIBUTE);
}

/** Inline script for the top of the page: runs before first paint. Harmless if it throws (the page just shows the signed-out buttons). */
export const AUTH_HINT_SCRIPT = `(function(){try{var d=document.documentElement;if((${detectSignedIn.toString()})(document.cookie)){d.setAttribute("${AUTH_ATTRIBUTE}","in")}else{d.removeAttribute("${AUTH_ATTRIBUTE}")}}catch(e){}})()`;
