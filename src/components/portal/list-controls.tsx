import { Tabs } from "@/components/portal/cards";
import { ButtonLink } from "@/components/ui/button";

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
 * Filter links (plain server links — the URL is the state, so filters are shareable, bookmarkable and work
 * without JavaScript). Drawn as the dashboard's segmented tabs; `variant="inset"` for use inside a white card.
 */
export function FilterLinks({
  items,
  current,
  hrefFor,
  label,
  variant,
}: {
  items: { id: string; label: string; count?: number }[];
  current: string;
  hrefFor: (id: string) => string;
  label: string;
  variant?: "page" | "inset";
}) {
  return <Tabs items={items} current={current} hrefFor={hrefFor} label={label} variant={variant} />;
}

/** "Page 2 of 5" with previous/next buttons. Hidden when there is only one page. */
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
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4">
      <ButtonLink href={hrefFor(Math.max(1, page - 1))} variant="secondary" size="sm" disabled={page <= 1} rel="prev">
        Previous
      </ButtonLink>
      <p className="num-tabular text-[13px] text-muted">
        Page {page} of {pageCount}
      </p>
      <ButtonLink href={hrefFor(Math.min(pageCount, page + 1))} variant="secondary" size="sm" disabled={page >= pageCount} rel="next">
        Next
      </ButtonLink>
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
