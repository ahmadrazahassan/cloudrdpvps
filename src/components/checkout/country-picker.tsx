"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { CountryFlag } from "@/components/shared/primitives";
import type { Location, ProductType } from "@/content/catalog";
import { REGIONS, worldCountry } from "@/content/world";
import { countryStatus, type CatalogSlice } from "@/lib/checkout";
import { cn, formatUsd } from "@/lib/utils";

/** The region filter shows only when there are enough countries to need it. */
const REGION_FILTER_FROM = 12;

/**
 * Choosing the country as one quiet field: it shows the current country and opens a searchable list. In the list the countries
 * that can be ordered come first with their starting price; the rest stay, greyed, each saying plainly why it can't be chosen.
 */
export function CountryPicker({
  catalog,
  product,
  productLabel,
  selected,
  onSelect,
  invalid = false,
}: {
  catalog: CatalogSlice;
  product: ProductType;
  productLabel: string;
  selected: Location | undefined;
  onSelect: (slug: string) => void;
  /** Draw attention to the field (no country has been chosen yet). */
  invalid?: boolean;
}) {
  const uid = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("all");

  const rows = useMemo(
    () =>
      catalog.locations.map((l) => ({
        l,
        s: countryStatus(catalog, product, l.id),
        region: worldCountry(l.iso2)?.region ?? "Other",
      })),
    [catalog, product],
  );
  const regions = useMemo(() => [...REGIONS, "Other" as const].filter((r) => rows.some((x) => x.region === r)), [rows]);
  const current = rows.find((r) => r.l.id === selected?.id);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => (region === "all" || r.region === region) && (!q || r.l.name.toLowerCase().includes(q) || r.l.iso2.toLowerCase() === q))
      .sort((a, b) => Number(b.s.orderable > 0) - Number(a.s.orderable > 0)); // stable: the owner's order is kept inside each group
  }, [rows, query, region]);
  const open_ = rows.filter((r) => r.s.orderable > 0).length;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setQuery("");
          setRegion("all");
        }
      }}
    >
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={selected ? `Country: ${selected.name}. Change country` : "Choose a country"}
          className={cn(
            "flex w-full items-center gap-3.5 rounded-[14px] border bg-white px-4 py-3.5 text-left transition-colors hover:border-muted",
            invalid ? "border-lav-500" : "border-line-2",
          )}
        >
          {selected ? <CountryFlag iso2={selected.iso2} className="h-[22px] w-[33px]" /> : null}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-semibold text-ink">{selected ? selected.name : "Choose a country"}</span>
            {current && (
              <span className="num-tabular block truncate text-[13px] text-muted">
                {current.s.from !== null ? `from ${formatUsd(current.s.from)} / 30 days` : current.s.state === "sold_out" ? "Out of stock right now" : `${productLabel} isn't offered here`}
              </span>
            )}
          </span>
          <ChevronDown size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-ink/35 data-[state=open]:animate-[fade-in_0.2s_ease-out]" />
        <Dialog.Content
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            searchRef.current?.focus();
          }}
          className="fixed left-1/2 top-1/2 z-[70] flex max-h-[min(640px,calc(100dvh-32px))] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[20px] bg-bg shadow-[0_24px_64px_-16px_rgb(18_18_20/0.4)] outline-none data-[state=open]:animate-[fade-in_0.2s_ease-out]"
        >
          <div className="flex items-center justify-between gap-4 px-6 pb-3 pt-6">
            <div>
              <Dialog.Title className="font-display text-[22px] font-semibold tracking-[-0.02em] text-ink">Choose your country</Dialog.Title>
              <Dialog.Description className="mt-1 text-[13px] text-muted">
                {open_} of {rows.length} countries have {productLabel} in stock.
              </Dialog.Description>
            </div>
            <Dialog.Close className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-btn hover:bg-black/[0.05]" aria-label="Close">
              <X size={20} strokeWidth={1.5} aria-hidden />
            </Dialog.Close>
          </div>

          <div className="px-6 pb-3">
            <div className="relative">
              <label htmlFor={`${uid}-q`} className="sr-only">
                Search countries
              </label>
              <Search size={18} strokeWidth={1.75} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                ref={searchRef}
                id={`${uid}-q`}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${rows.length} countries`}
                autoComplete="off"
                className="field-input !pl-10"
              />
            </div>
            {rows.length >= REGION_FILTER_FROM && regions.length > 1 && (
              <div className="-mx-1 mt-3 flex flex-wrap gap-1" role="group" aria-label="Filter by region">
                {["all", ...regions].map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={region === r}
                    onClick={() => setRegion(r)}
                    className={cn(
                      "h-8 rounded-full px-3 text-[12.5px] font-medium transition-colors",
                      region === r ? "bg-ink text-white" : "text-ink-2 hover:bg-black/[0.05]",
                    )}
                  >
                    {r === "all" ? "All" : r}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div role="radiogroup" aria-label="Country" className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-line px-3 py-2">
            {shown.length === 0 ? (
              <p className="px-3 py-10 text-center text-[14px] text-muted">
                No country matches “{query}”.{" "}
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setRegion("all");
                  }}
                  className="text-link"
                >
                  Show all
                </button>
              </p>
            ) : (
              shown.map((r) => {
                const checked = r.l.id === selected?.id;
                const ok = r.s.orderable > 0;
                return (
                  <label
                    key={r.l.id}
                    className={cn(
                      "relative flex items-center gap-3.5 rounded-[12px] px-3 py-3 transition-colors",
                      ok ? "cursor-pointer hover:bg-black/[0.04]" : "cursor-not-allowed",
                      checked && "bg-lav-50",
                      "has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-lav-500",
                    )}
                  >
                    <input
                      type="radio"
                      name={`${uid}-country`}
                      value={r.l.slug}
                      checked={checked}
                      aria-disabled={!ok || undefined}
                      onChange={() => {
                        if (!ok) return;
                        onSelect(r.l.slug);
                        setOpen(false);
                      }}
                      className="absolute inset-0 h-full w-full cursor-[inherit] opacity-0"
                    />
                    <CountryFlag iso2={r.l.iso2} className={cn("h-[20px] w-[30px]", !ok && "opacity-50 grayscale")} />
                    <span className={cn("min-w-0 flex-1 truncate text-[15px]", ok ? "font-medium text-ink" : "text-muted")}>{r.l.name}</span>
                    <span className="num-tabular shrink-0 text-[13px] text-muted">
                      {ok ? `from ${formatUsd(r.s.from ?? 0)}` : r.s.state === "sold_out" ? "Out of stock" : `No ${productLabel}`}
                    </span>
                    <span className="flex w-4 shrink-0 justify-end">{checked && <Check size={16} strokeWidth={2.25} aria-hidden className="text-lav-700" />}</span>
                  </label>
                );
              })
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
