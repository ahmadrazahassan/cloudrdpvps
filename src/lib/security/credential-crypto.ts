import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for server login details. The database only ever stores the
 * token produced here; the key never reaches it.
 *
 *   token = v1.<kid>.<iv>.<tag>.<ciphertext>      (each part base64url)
 *
 * - `kid` names the key used, so keys can be rotated: the first key in the
 *   keyring encrypts, every key decrypts.
 * - The AAD binds a token to this purpose; GCM's tag rejects any tampering.
 * - A fresh random 96-bit IV per message (never reused with a key).
 *
 * Pure functions (no env access) — see `credentials.ts` for the configured wrapper.
 */

const VERSION = "v1";
const AAD = Buffer.from("crv-cred", "utf8");
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KID_RE = /^[A-Za-z0-9_-]{1,16}$/;

export interface Keyring {
  /** Key id used for new encryptions. */
  activeKid: string;
  keys: ReadonlyMap<string, Buffer>;
}

/** Parse `kid:base64key[,kid2:base64key2]` — first entry is the active key. */
export function parseKeyring(spec: string): Keyring {
  const keys = new Map<string, Buffer>();
  let activeKid: string | undefined;
  for (const entry of spec.split(",").map((s) => s.trim()).filter(Boolean)) {
    const idx = entry.indexOf(":");
    const kid = idx === -1 ? "" : entry.slice(0, idx);
    const b64 = idx === -1 ? "" : entry.slice(idx + 1);
    if (!KID_RE.test(kid)) throw new Error(`CREDENTIAL_KEYS: invalid key id "${kid}" (use 1-16 letters, digits, - or _)`);
    if (keys.has(kid)) throw new Error(`CREDENTIAL_KEYS: duplicate key id "${kid}"`);
    const key = Buffer.from(b64, "base64");
    if (key.length !== KEY_BYTES) {
      throw new Error(`CREDENTIAL_KEYS: key "${kid}" must be exactly ${KEY_BYTES} bytes (base64 of 32 random bytes)`);
    }
    keys.set(kid, key);
    activeKid ??= kid;
  }
  if (!activeKid) throw new Error("CREDENTIAL_KEYS: at least one key is required");
  return { activeKid, keys };
}

/** Helper for `scripts/` and docs: a fresh key spec entry. */
export function generateKeySpec(kid = "k1"): string {
  return `${kid}:${randomBytes(KEY_BYTES).toString("base64")}`;
}

export function encryptSecret(plaintext: string, ring: Keyring): string {
  const key = ring.keys.get(ring.activeKid);
  if (!key) throw new Error("Active credential key is missing from the keyring");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(AAD);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, ring.activeKid, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export class CredentialDecryptError extends Error {
  constructor(reason: string) {
    super(`Could not decrypt stored credential (${reason})`);
    this.name = "CredentialDecryptError";
  }
}

export function decryptSecret(token: string, ring: Keyring): string {
  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== VERSION) throw new CredentialDecryptError("unrecognised format");
  const [, kid, ivB64, tagB64, ctB64] = parts as [string, string, string, string, string];
  const key = ring.keys.get(kid);
  if (!key) throw new CredentialDecryptError(`unknown key id`);
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new CredentialDecryptError("bad parameters");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(AAD);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    // Wrong key, tampered ciphertext or tag — deliberately indistinguishable.
    throw new CredentialDecryptError("authentication failed");
  }
}

/** True when a token was written with an older key and should be re-encrypted. */
export function needsRotation(token: string, ring: Keyring): boolean {
  return token.split(".")[1] !== ring.activeKid;
}

/** Cheap shape check for values arriving from the DB or an admin form (does not authenticate). */
export function looksEncrypted(token: string): boolean {
  const p = token.split(".");
  return p.length === 5 && p[0] === VERSION && KID_RE.test(p[1] ?? "");
}
