"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { CountryFlag } from "@/components/shared/primitives";
import { REGIONS } from "@/content/world";
import { cn, formatUsd } from "@/lib/utils";

export interface CountryItem {
  slug: string;
  name: string;
  iso2: string;
  region: string;
  /** Lowest price (cents) in stock there, per product; null when it isn't on sale. */
  rdp: number | null;
  vps: number | null;
}

/** The search box and region pills show only when there are enough countries to need them. */
const FILTER_FROM = 9;

/**
 * Every country we sell in, laid out to be found: grouped by region and centred, each one a flag and its real name that opens
 * that country's page. Type to search, or tap a region to narrow it. With `prices`, each shows what Windows RDP and Windows VPS
 * start at there.
 */
export function CountryExplorer({ items, prices = false, className }: { items: CountryItem[]; prices?: boolean; className?: string }) {
  const uid = useId();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("all");

  const regions = useMemo(() => [...REGIONS, "Other" as const].filter((r) => items.some((i) => i.region === r)), [items]);
  const filterable = items.length >= FILTER_FROM;
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => items.filter((i) => (region === "all" || i.region === region) && (!q || i.name.toLowerCase().includes(q) || i.iso2.toLowerCase() === q)),
    [items, region, q],
  );
  const grouped = filterable && region === "all" && !q;
  const groups = useMemo(
    () => (grouped ? regions.map((r) => ({ region: r, items: shown.filter((i) => i.region === r) })).filter((g) => g.items.length) : [{ region: "", items: shown }]),
    [grouped, regions, shown],
  );
  const countIn = (r: string) => items.filter((i) => i.region === r).length;

  return (
    <div className={className}>
      {filterable && (
        <div className="text-center">
          <div className="relative mx-auto max-w-[520px] text-left">
            <label htmlFor={`${uid}-q`} className="sr-only">
              Search countries
            </label>
            <Search size={18} strokeWidth={1.75} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input id={`${uid}-q`} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${items.length} countries`} autoComplete="off" className="field-input !rounded-full !pl-11" />
          </div>
          {regions.length > 1 && (
            <div className="mt-5 flex flex-wrap justify-center gap-1.5" role="group" aria-label="Filter by region">
              {["all", ...regions].map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={region === r}
                  onClick={() => setRegion(r)}
                  className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-colors", region === r ? "bg-ink text-white" : "text-ink-2 hover:bg-black/[0.06]")}
                >
                  {r === "all" ? "All" : r}
                  <span className={cn("num-tabular text-[12px]", region === r ? "text-white/65" : "text-muted")}>{r === "all" ? items.length : countIn(r)}</span>
                </button>
              ))}
            </div>
          )}
          <p className="sr-only" role="status" aria-live="polite">
            {shown.length} of {items.length} countries shown
          </p>
        </div>
      )}

      {shown.length === 0 ? (
        <p className="mt-10 text-center text-[15px] text-muted">
          No country matches “{query}”.{" "}
          <button type="button" onClick={() => { setQuery(""); setRegion("all"); }} className="text-link">
            Show all
          </button>
        </p>
      ) : (
        <div className={cn("mx-auto max-w-[1120px] space-y-12", filterable && "mt-10")}>
          {groups.map((g) => (
            <section key={g.region || "all"} aria-label={g.region || "Countries"}>
              {g.region && (
                <h3 className="mb-5 text-center">
                  <span className="label-caps">{g.region}</span>
                  <span className="num-tabular ml-2 text-[12px] text-muted">{g.items.length}</span>
                </h3>
              )}
              <ul className="flex flex-wrap justify-center gap-3">
                {g.items.map((i) => (
                  <li key={i.slug} className="w-[calc(50%-6px)] sm:w-[calc(33.333%-8px)] lg:w-[calc(25%-9px)] xl:w-[calc(20%-9.6px)]">
                    <Link
                      href={`/locations/${i.slug}`}
                      title={i.name}
                      className="flex h-full min-h-[52px] items-center gap-3 rounded-[14px] bg-white px-3.5 py-2.5 text-left shadow-[0_1px_2px_rgb(18_18_20/0.05)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-12px_rgb(18_18_20/0.3)]"
                    >
                      <CountryFlag iso2={i.iso2} className="h-[20px] w-[30px]" />
                      <span className="min-w-0">
                        <span className="line-clamp-2 block text-[14.5px] font-medium leading-tight text-ink">{i.name}</span>
                        {prices && (
                          <span className="num-tabular mt-0.5 block truncate text-[12px] text-muted">
                            {i.rdp !== null && <>RDP {formatUsd(i.rdp)}</>}
                            {i.rdp !== null && i.vps !== null && " · "}
                            {i.vps !== null && <>VPS {formatUsd(i.vps)}</>}
                            {i.rdp === null && i.vps === null && "Out of stock"}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
