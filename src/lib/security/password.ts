import { randomInt } from "node:crypto";

// No look-alikes (0/O, 1/l/I) and no characters that need escaping in RDP
// clients, shells or URLs (quotes, backslash, space, &, <, >, %).
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGIT = "23456789";
const SYMBOL = "!#$*+-=?@^_~";
const ALL = UPPER + LOWER + DIGIT + SYMBOL;

const pick = (set: string) => set[randomInt(set.length)]!;

/**
 * Cryptographically random Windows-friendly password. Always contains all four
 * character classes (Windows requires three), so it passes default complexity rules.
 */
export function generatePassword(length = 20): string {
  if (!Number.isInteger(length) || length < 12 || length > 64) {
    throw new RangeError("Password length must be an integer between 12 and 64");
  }
  const chars = [pick(UPPER), pick(LOWER), pick(DIGIT), pick(SYMBOL)];
  while (chars.length < length) chars.push(pick(ALL));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}
