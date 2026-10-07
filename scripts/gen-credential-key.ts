/** Prints a fresh CREDENTIAL_KEYS entry:  npm run key:gen [kid] */
import { generateKeySpec } from "../src/lib/security/credential-crypto";

const kid = process.argv[2] ?? `k${new Date().getFullYear()}`;
console.log(`CREDENTIAL_KEYS=${generateKeySpec(kid)}`);
console.error(
  "\nPut this in .env.local / your host's secrets. To rotate later, generate another key and list it FIRST,\n" +
    "keeping the old one after it (comma separated) so existing passwords still decrypt.\n" +
    "Back the keys up somewhere safe: without them stored server passwords cannot be recovered.",
);
