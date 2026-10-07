import Link from "next/link";
import { cn } from "@/lib/utils";

/** Build `/path?a=1&b=2`, dropping empty values and the default page. */
export function withParams(path: string, params: Record<string, string | number | null | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === "" || (k === "page" && Number(v) <= 1)) continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

/**
 * Underline filter links (plain server links — the URL is the state, so filters are
 * shareable, bookmarkable and work without JavaScript).
 */
export function FilterLinks({
  items,
  current,
  hrefFor,
  label,
}: {
  items: { id: string; label: string; count?: number }[];
  current: string;
  hrefFor: (id: string) => string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="overflow-x-auto">
      <ul className="flex min-w-max gap-7 border-b border-line">
        {items.map((it) => {
          const active = it.id === current;
          return (
            <li key={it.id}>
              <Link
                href={hrefFor(it.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative -mb-px inline-flex h-11 items-center gap-2 text-[14px] font-medium transition-colors",
                  active ? "text-ink" : "text-muted hover:text-ink",
                )}
              >
                {it.label}
                {it.count !== undefined && <span className="num-tabular text-[12px] text-muted">{it.count}</span>}
                {active && <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-lav-600" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** "Page 2 of 5" with previous/next links. Hidden when there is only one page. */
export function Pagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  const link = "text-link text-[14px]";
  const off = "text-[14px] text-line-2";
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-between border-t border-line pt-5">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={link}>
          ← Previous
        </Link>
      ) : (
        <span aria-hidden className={off}>
          ← Previous
        </span>
      )}
      <p className="num-tabular text-[13px] text-muted">
        Page {page} of {pageCount}
      </p>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} rel="next" className={link}>
          Next →
        </Link>
      ) : (
        <span aria-hidden className={off}>
          Next →
        </span>
      )}
    </nav>
  );
}

/** Reads one value from Next's searchParams (which may be an array). */
export const param = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** A positive integer from the URL, defaulting to 1. */
export const pageParam = (v: string | string[] | undefined) => {
  const n = Number.parseInt(param(v) ?? "1", 10);
  return Number.isFinite(n) && n > 0 && n < 10_000 ? n : 1;
};
