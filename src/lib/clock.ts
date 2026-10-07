/**
 * The current time, read once per request by server pages that show countdowns, "expires in N days"
 * and relative times. These pages are rendered per visitor on demand (they read the session), so the
 * clock is legitimately part of the output; keeping the read in one named function also makes the
 * dependency explicit and lets tests substitute a fixed time.
 */
export const now = (): number => Date.now();
