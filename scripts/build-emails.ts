// Builds the two email assets that live in the repo:
//   public/brand/email-logo.png      the real logo (ink C + lavender dot + wordmark) as a small 2x PNG, hosted on the
//                                    site and linked from every email (email clients can't show SVG reliably)
//   supabase/templates/*.html        the six Supabase Auth emails, from src/lib/email/auth-emails.ts
// Run after changing the logo or an auth email:  npm run emails:build
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { AUTH_EMAILS, renderAuthEmail } from "../src/lib/email/auth-emails";

const root = path.resolve(__dirname, "..");
const sharp = createRequire(path.join(root, "package.json"))("sharp") as (input: Buffer, options?: { density?: number }) => import("sharp").Sharp;

async function main() {
  // Displayed at 176px wide; drawn at 352px so it stays sharp on high-density screens.
  const logo = readFileSync(path.join(root, "public/brand/logo.svg"));
  const out = path.join(root, "public/brand/email-logo.png");
  await sharp(logo, { density: 144 }).resize({ width: 352 }).png({ compressionLevel: 9, palette: true, quality: 100 }).toFile(out);

  const dir = path.join(root, "supabase/templates");
  mkdirSync(dir, { recursive: true });
  for (const email of AUTH_EMAILS) writeFileSync(path.join(dir, email.file), renderAuthEmail(email));

  console.log(`Wrote ${path.relative(root, out)} and ${AUTH_EMAILS.length} templates in supabase/templates/.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
