import "server-only";
import { requireServerEnv } from "@/lib/env.server";
import { decryptSecret, encryptSecret, needsRotation, parseKeyring, type Keyring } from "./credential-crypto";

let ring: Keyring | undefined;
let ringSpec: string | undefined;

function keyring(): Keyring {
  const spec = requireServerEnv("CREDENTIAL_KEYS");
  if (!ring || ringSpec !== spec) {
    ring = parseKeyring(spec);
    ringSpec = spec;
  }
  return ring;
}

/** Encrypt a server password for storage. The result is all the database ever sees. */
export const encryptCredential = (plaintext: string) => encryptSecret(plaintext, keyring());

/** Decrypt on the server just before showing it to the owner (or an admin). Never log the result. */
export const decryptCredential = (token: string) => decryptSecret(token, keyring());

/** True when a stored token should be re-encrypted under the current active key. */
export const credentialNeedsRotation = (token: string) => needsRotation(token, keyring());
