/** `jane.doe@gmail.com` -> `j•••@gmail.com`. Shown on screens where the full address isn't needed. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "your email";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return `${local[0]}${"•".repeat(Math.min(Math.max(local.length - 1, 2), 6))}@${domain}`;
}
