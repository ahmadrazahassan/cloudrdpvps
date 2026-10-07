import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CredentialDecryptError, decryptSecret, encryptSecret, generateKeySpec, looksEncrypted, needsRotation, parseKeyring,
} from "./credential-crypto";
import { checkUpload, MAX_UPLOAD_BYTES, sniffMime } from "./file-sniff";
import { generatePassword } from "./password";
import { buildRdpFile, rdpFilename } from "./rdp-file";

describe("credential encryption", () => {
  const ring = parseKeyring(`k1:${randomBytes(32).toString("base64")}`);

  it("round-trips, including unicode and symbols", () => {
    for (const secret of ["P@ssw0rd!", "пароль-密码-🔑", "a".repeat(500), ""]) {
      expect(decryptSecret(encryptSecret(secret, ring), ring)).toBe(secret);
    }
  });

  it("uses the documented token format and never leaks the plaintext", () => {
    const token = encryptSecret("hunter2-hunter2", ring);
    expect(token).toMatch(/^v1\.k1\.[\w-]+\.[\w-]+\.[\w-]*$/);
    expect(token).not.toContain("hunter2");
    expect(looksEncrypted(token)).toBe(true);
    expect(looksEncrypted("plain-password")).toBe(false);
  });

  it("uses a fresh IV every time (same input, different ciphertext)", () => {
    const a = encryptSecret("same", ring);
    const b = encryptSecret("same", ring);
    expect(a).not.toBe(b);
    expect(decryptSecret(a, ring)).toBe(decryptSecret(b, ring));
  });

  it("rejects any tampering with iv, tag or ciphertext", () => {
    const [v, kid, iv, tag, ct] = encryptSecret("secret-value", ring).split(".") as [string, string, string, string, string];
    const flip = (s: string) => (s[0] === "A" ? "B" : "A") + s.slice(1);
    for (const bad of [[v, kid, flip(iv), tag, ct], [v, kid, iv, flip(tag), ct], [v, kid, iv, tag, flip(ct)]]) {
      expect(() => decryptSecret(bad.join("."), ring)).toThrow(CredentialDecryptError);
    }
  });

  it("rejects wrong keys, unknown key ids, bad versions and garbage", () => {
    const token = encryptSecret("x", ring);
    const other = parseKeyring(`k1:${randomBytes(32).toString("base64")}`);
    expect(() => decryptSecret(token, other)).toThrow(CredentialDecryptError);
    expect(() => decryptSecret(token.replace(".k1.", ".zz."), ring)).toThrow(/unknown key id/);
    expect(() => decryptSecret(token.replace("v1.", "v2."), ring)).toThrow(/format/);
    expect(() => decryptSecret("not-a-token", ring)).toThrow(CredentialDecryptError);
  });

  it("supports key rotation: new keys encrypt, old keys still decrypt", () => {
    const k1 = randomBytes(32).toString("base64");
    const k2 = randomBytes(32).toString("base64");
    const oldRing = parseKeyring(`k1:${k1}`);
    const newRing = parseKeyring(`k2:${k2},k1:${k1}`);
    const legacy = encryptSecret("rotate-me", oldRing);
    expect(needsRotation(legacy, newRing)).toBe(true);
    expect(decryptSecret(legacy, newRing)).toBe("rotate-me");
    const fresh = encryptSecret("rotate-me", newRing);
    expect(fresh.split(".")[1]).toBe("k2");
    expect(needsRotation(fresh, newRing)).toBe(false);
  });

  it("validates the keyring spec", () => {
    expect(() => parseKeyring("")).toThrow(/at least one/);
    expect(() => parseKeyring("k1:short")).toThrow(/32 bytes/);
    expect(() => parseKeyring(`bad id:${randomBytes(32).toString("base64")}`)).toThrow(/invalid key id/);
    const k = randomBytes(32).toString("base64");
    expect(() => parseKeyring(`a:${k},a:${k}`)).toThrow(/duplicate/);
    expect(parseKeyring(generateKeySpec("prod1")).activeKid).toBe("prod1");
  });
});

describe("generatePassword", () => {
  it("meets Windows complexity and avoids ambiguous/awkward characters", () => {
    for (let i = 0; i < 300; i++) {
      const p = generatePassword();
      expect(p).toHaveLength(20);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[0-9]/);
      expect(p).toMatch(/[!#$*+\-=?@^_~]/);
      expect(p).not.toMatch(/[0OIl1"'\\\s&<>%`]/);
    }
  });

  it("is not repeatable and enforces sane length bounds", () => {
    expect(new Set(Array.from({ length: 200 }, () => generatePassword())).size).toBe(200);
    expect(generatePassword(12)).toHaveLength(12);
    expect(() => generatePassword(8)).toThrow(RangeError);
    expect(() => generatePassword(200)).toThrow(RangeError);
  });
});

describe(".rdp file", () => {
  it("builds a CRLF file with the address and username, and no password", () => {
    const f = buildRdpFile({ host: "203.0.113.10", username: "Administrator" });
    expect(f).toContain("full address:s:203.0.113.10\r\n");
    expect(f).toContain("username:s:Administrator\r\n");
    expect(f).toContain("prompt for credentials:i:1");
    expect(f.toLowerCase()).not.toContain("password");
    expect(f.endsWith("\r\n")).toBe(true);
  });

  it("includes a non-default port and accepts hostnames", () => {
    expect(buildRdpFile({ host: "srv-1.example.com", port: 3390, username: "u" })).toContain("full address:s:srv-1.example.com:3390");
  });

  it("refuses values that could inject extra settings", () => {
    expect(() => buildRdpFile({ host: "1.2.3.4\r\nfull address:s:evil", username: "u" })).toThrow();
    expect(() => buildRdpFile({ host: "1.2.3.4", username: "a\r\nredirectdrives:i:1" })).toThrow();
    expect(() => buildRdpFile({ host: "1.2.3.4", port: 0, username: "u" })).toThrow();
    expect(() => buildRdpFile({ host: "1.2.3.4", port: 70000, username: "u" })).toThrow();
    expect(() => buildRdpFile({ host: "", username: "u" })).toThrow();
    expect(() => buildRdpFile({ host: "bad host", username: "u" })).toThrow();
  });

  it("makes safe filenames", () => {
    expect(rdpFilename("Trading VPS #1")).toBe("Trading-VPS-1.rdp");
    expect(rdpFilename("../../etc/passwd")).toBe("etcpasswd.rdp");
    expect(rdpFilename("???")).toBe("server.rdp");
    expect(rdpFilename('a"b\r\nc')).toBe("abc.rdp");
  });
});

describe("upload sniffing", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3]);
  const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1]);
  const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50]);
  const pdf = new TextEncoder().encode("%PDF-1.7\n%âãÏÓ\n1 0 obj");

  it("identifies allowed types by content", () => {
    expect(sniffMime(png)).toBe("image/png");
    expect(sniffMime(jpg)).toBe("image/jpeg");
    expect(sniffMime(webp)).toBe("image/webp");
    expect(sniffMime(pdf)).toBe("application/pdf");
  });

  it("rejects scripts, HTML, SVG and executables regardless of what they claim to be", () => {
    const enc = (s: string) => new TextEncoder().encode(s.padEnd(32, " "));
    expect(sniffMime(enc("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffMime(enc('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(sniffMime(enc("MZ\u0090\u0000 this is an exe"))).toBeNull();
    expect(sniffMime(enc("GIF89a............"))).toBeNull();
    expect(sniffMime(new Uint8Array(4))).toBeNull();
  });

  it("checkUpload returns the facts to record, enforcing size limits", () => {
    const r = checkUpload(png)!;
    expect(r).toMatchObject({ mime: "image/png", ext: "png", size: png.length });
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(checkUpload(new Uint8Array(0))).toBeNull();
    const huge = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    huge.set(png);
    expect(checkUpload(huge)).toBeNull();
    const exactly = new Uint8Array(MAX_UPLOAD_BYTES);
    exactly.set(png);
    expect(checkUpload(exactly)).not.toBeNull();
  });
});
