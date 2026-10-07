const LOWER = "abcdefghijkmnopqrstuvwxyz"; // no l
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I, O
const DIGITS = "23456789"; // no 0, 1
const SYMBOLS = "!@#$%^&*-_=+";
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

/** A uniformly random index below `max`, without modulo bias (rejection sampling on 32-bit values). */
function randomBelow(max: number, bytes: (n: number) => Uint32Array): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  for (;;) {
    const v = bytes(1)[0]!;
    if (v < limit) return v % max;
  }
}

const browserBytes = (n: number) => crypto.getRandomValues(new Uint32Array(n));

/**
 * A strong Windows password: 20 characters from letters (without look-alikes), digits and symbols,
 * with at least one of each class so it satisfies Windows' complexity rule. Uses the Web Crypto
 * random source — in the browser, so the password never travels anywhere before the staff member sees it.
 */
export function generatePassword(length = 20, bytes: (n: number) => Uint32Array = browserBytes): string {
  const pick = (set: string) => set[randomBelow(set.length, bytes)]!;
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(ALL));
  // Fisher–Yates so the guaranteed characters don't always lead
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1, bytes);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}
