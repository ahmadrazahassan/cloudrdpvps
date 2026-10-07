/** Pure helpers shared by console queries and tests (no database, no server-only). */

/**
 * Make a free-text search safe to drop into a PostgREST `or(...)` filter: commas, parentheses, quotes,
 * wildcards and backslashes all carry meaning there, so they are removed rather than escaped.
 */
export function cleanSearch(q: string | undefined | null): string {
  return (q ?? "").replace(/[,()*%\\"'`;:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 64);
}

/** `col1.ilike.%term%,col2.ilike.%term%` for `.or()`. Returns null for an empty search. */
export function searchFilter(columns: string[], q: string | undefined | null): string | null {
  const term = cleanSearch(q);
  if (!term) return null;
  return columns.map((c) => `${c}.ilike.%${term}%`).join(",");
}

export const displayName = (p: { full_name: string; email: string } | undefined | null) =>
  p ? p.full_name.trim() || p.email : "Unknown customer";

/** Pull a string / number out of a jsonb snapshot without trusting its shape. */
export const jsonString = (v: unknown, key: string): string | null => {
  if (v && typeof v === "object" && key in v) {
    const x = (v as Record<string, unknown>)[key];
    return typeof x === "string" ? x : null;
  }
  return null;
};
export const jsonNumber = (v: unknown, key: string): number | null => {
  if (v && typeof v === "object" && key in v) {
    const x = (v as Record<string, unknown>)[key];
    return typeof x === "number" ? x : null;
  }
  return null;
};

/** Escape a CSV cell. Cells that start with = + - @ are prefixed so spreadsheets never run them as formulas. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const toCsv = (header: string[], rows: unknown[][]) =>
  [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
