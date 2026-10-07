import type { NextConfig } from "next";

/**
 * Response headers every page gets. They cost nothing and close whole classes of attack:
 *  - nosniff            browsers must trust the declared file type (uploads are served by Supabase, not us, but still)
 *  - frame protection   nobody can put our pages in an invisible frame to trick a click (clickjacking)
 *  - referrer policy    other sites only learn our origin, never a private URL like /dashboard/orders/<id>
 *  - permissions        the site never needs the camera, microphone or location, so the browser is told to refuse them
 *  - HSTS               once a visitor has used https they never go back to http (ignored on http://localhost)
 *  - COOP               other windows can't hold a handle to ours
 * A Content-Security-Policy is the next step; it needs per-request nonces for Next's inline scripts, so it is a separate piece of work.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

/**
 * Addresses people type, bookmark or share, all landing on the one real page. Permanent (308) where the destination will never
 * change, so search engines and browsers remember it. The order page keeps its whole configuration in the query string
 * (/order/new?product=rdp&plan=standard&country=pakistan&step=review); the path forms below are the short, shareable versions.
 */
const redirects: NonNullable<NextConfig["redirects"]> = async () => [
  // ---- ordering ----
  { source: "/order", destination: "/order/new", permanent: true },
  { source: "/checkout", destination: "/order/new", permanent: true },
  { source: "/buy", destination: "/order/new", permanent: true },
  { source: "/order/:product(rdp|vps)", destination: "/order/new?product=:product", permanent: false },
  { source: "/order/:product(rdp|vps)/:plan", destination: "/order/new?product=:product&plan=:plan", permanent: false },
  { source: "/order/:product(rdp|vps)/:plan/:country", destination: "/order/new?product=:product&plan=:plan&country=:country", permanent: false },
  // ---- accounts ----
  { source: "/signin", destination: "/login", permanent: true },
  { source: "/sign-in", destination: "/login", permanent: true },
  { source: "/log-in", destination: "/login", permanent: true },
  { source: "/signup", destination: "/register", permanent: true },
  { source: "/sign-up", destination: "/register", permanent: true },
  { source: "/account", destination: "/dashboard", permanent: false },
  { source: "/orders", destination: "/dashboard/orders", permanent: false },
  { source: "/billing", destination: "/dashboard/billing", permanent: false },
  { source: "/forgot", destination: "/forgot-password", permanent: true },
  // ---- the public pages, under their other names ----
  { source: "/plans", destination: "/pricing", permanent: true },
  { source: "/price", destination: "/pricing", permanent: true },
  { source: "/faqs", destination: "/faq", permanent: true },
  { source: "/help", destination: "/contact", permanent: true },
  { source: "/support", destination: "/contact", permanent: true },
  { source: "/countries", destination: "/locations", permanent: true },
  { source: "/windows-rdp", destination: "/rdp", permanent: true },
  { source: "/windows-vps", destination: "/vps", permanent: true },
  { source: "/terms", destination: "/legal/terms", permanent: true },
  { source: "/privacy", destination: "/legal/privacy", permanent: true },
  { source: "/refund", destination: "/legal/refund", permanent: true },
  { source: "/tos", destination: "/legal/terms", permanent: true },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Lets a second build (a preview with DEMO_COUNTRIES, say) live beside the normal one without touching `.next`.
  distDir: process.env.QA_DIST_DIR || ".next",
  redirects,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    serverActions: {
      // Payment proofs and ticket attachments are posted to Server Actions as multipart
      // FormData. Files are capped at 5 MB (see lib/security/file-sniff.ts); the extra
      // headroom is multipart overhead, per the Next.js docs. Rate limits sit in front of
      // every upload action.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
