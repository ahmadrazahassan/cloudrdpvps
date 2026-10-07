"use client";

import { useMemo, useState, useTransition } from "react";
import { CountryFlag } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
import { REGIONS } from "@/content/world";
import { setCountryAvailability } from "@/lib/admin/actions/countries";
import { formatUsd } from "@/lib/utils";

export interface CountryRow {
  iso2: string;
  name: string;
  region: string;
  rdp: boolean;
  vps: boolean;
  /** Lowest price (cents) on sale there, per product. */
  rdpFrom: number | null;
  vpsFrom: number | null;
}

type Product = "rdp" | "vps";
type Status = "all" | "on" | "off";

const field = "h-9 rounded-btn border border-line-2 bg-transparent px-2.5 text-[14px] text-ink outline-none hover:border-muted focus:border-lav-600";

/**
 * Pick where Windows RDP and Windows VPS are sold. Every country in the world list is here; tick RDP and/or VPS for a country
 * and it goes live on the site and in checkout. New countries are priced like the location chosen under "Price like"
 * (or each plan's cheapest existing price) so they can be ordered at once — fine-tune them on Pricing & stock.
 */
export function CountriesManager({
  rows,
  version,
  priceOptions,
  ready,
}: {
  rows: CountryRow[];
  /** Changes whenever the saved data does, so local edits are dropped once the server has caught up. */
  version: string;
  priceOptions: { id: string; name: string }[];
  ready: { rdp: boolean; vps: boolean };
}) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("all");
  const [status, setStatus] = useState<Status>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [priceLike, setPriceLike] = useState("");
  const [local, setLocal] = useState<{ version: string; map: Map<string, Partial<Record<Product, boolean>>> }>({ version, map: new Map() });
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const edits = useMemo(() => (local.version === version ? local.map : new Map<string, Partial<Record<Product, boolean>>>()), [local, version]);
  const view = useMemo(
    () =>
      rows.map((r) => {
        const e = edits.get(r.iso2);
        return { ...r, rdp: e?.rdp ?? r.rdp, vps: e?.vps ?? r.vps };
      }),
    [rows, edits],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return view.filter((r) => {
      if (region !== "all" && r.region !== region) return false;
      if (status === "on" && !(r.rdp || r.vps)) return false;
      if (status === "off" && (r.rdp || r.vps)) return false;
      return !q || r.name.toLowerCase().includes(q) || r.iso2.toLowerCase() === q;
    });
  }, [view, query, region, status]);

  const onSale = view.filter((r) => r.rdp || r.vps).length;
  const withRdp = view.filter((r) => r.rdp).length;
  const withVps = view.filter((r) => r.vps).length;

  function apply(countries: string[], products: Product[], enabled: boolean) {
    setMessage(null);
    start(async () => {
      const r = await setCountryAvailability({ countries, products, enabled, priceLike });
      if (!r.ok) {
        setMessage({ tone: "error", text: r.message });
        return;
      }
      setLocal((prev) => {
        const map = new Map(prev.version === version ? prev.map : []);
        for (const c of countries) map.set(c, { ...map.get(c), ...Object.fromEntries(products.map((p) => [p, enabled])) });
        return { version, map };
      });
      setSelected(new Set());
      const n = r.data.updated;
      setMessage({
        tone: "ok",
        text: `${enabled ? "Switched on" : "Switched off"} ${products.map((p) => p.toUpperCase()).join(" + ")} in ${n} ${n === 1 ? "country" : "countries"}${enabled && r.data.created ? ` — ${r.data.created} new price${r.data.created === 1 ? "" : "s"} created from the reference price` : ""}. The site is updated.`,
      });
    });
  }

  const allShownSelected = shown.length > 0 && shown.every((r) => selected.has(r.iso2));
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of shown) {
        if (allShownSelected) next.delete(r.iso2);
        else next.add(r.iso2);
      }
      return next;
    });

  return (
    <div className="pb-28">
      <p className="num-tabular text-[14px] text-ink-2" aria-live="polite">
        <strong className="font-semibold text-ink">{onSale}</strong> {onSale === 1 ? "country" : "countries"} on sale · <strong className="font-semibold text-ink">{withRdp}</strong> with Windows RDP ·{" "}
        <strong className="font-semibold text-ink">{withVps}</strong> with Windows VPS · {view.length} to choose from
      </p>
      {(!ready.rdp || !ready.vps) && (
        <p className="form-note mt-4" data-tone="error">
          {!ready.rdp && !ready.vps ? "There are no active plans yet." : `There are no active ${ready.rdp ? "VPS" : "RDP"} plans yet, so that product can't be switched on.`} Add plans on the Plans page and set their prices first.
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-end gap-3 border-y border-line py-4">
        <div>
          <label htmlFor="c-search" className="label-caps mb-1.5 block">
            Find a country
          </label>
          <input id="c-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Germany or DE" className={`${field} w-[240px]`} />
        </div>
        <div>
          <label htmlFor="c-region" className="label-caps mb-1.5 block">
            Region
          </label>
          <select id="c-region" value={region} onChange={(e) => setRegion(e.target.value)} className={field}>
            <option value="all">All regions</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="c-status" className="label-caps mb-1.5 block">
            Show
          </label>
          <select id="c-status" value={status} onChange={(e) => setStatus(e.target.value as Status)} className={field}>
            <option value="all">Everything</option>
            <option value="on">On sale</option>
            <option value="off">Not on sale</option>
          </select>
        </div>
        <div className="ml-auto">
          <label htmlFor="c-like" className="label-caps mb-1.5 block">
            Price new countries like
          </label>
          <select id="c-like" value={priceLike} onChange={(e) => setPriceLike(e.target.value)} className={`${field} max-w-[260px]`}>
            <option value="">Each plan&apos;s cheapest existing price</option>
            {priceOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className="form-note mt-5" data-tone={message.tone}>
          {message.text}
        </p>
      )}

      <div role="region" aria-label="Countries" className="mt-2">
        <div className="label-caps grid grid-cols-[28px_minmax(0,1fr)_110px_110px] items-center gap-x-4 border-b border-line-2 py-3 md:grid-cols-[28px_minmax(0,1.4fr)_120px_120px_minmax(0,1fr)]">
          <label className="check !items-center" title="Select every country shown">
            <input type="checkbox" checked={allShownSelected} onChange={toggleAll} aria-label="Select every country shown" />
          </label>
          <span>Country</span>
          <span>Windows RDP</span>
          <span>Windows VPS</span>
          <span className="hidden md:block">Starting at</span>
        </div>

        {shown.length === 0 ? (
          <p className="border-b border-line py-12 text-center text-[14px] text-muted">No country matches. Try a different search or filter.</p>
        ) : (
          <ul>
            {shown.map((r) => {
              return (
                <li key={r.iso2} className="ledger-row grid grid-cols-[28px_minmax(0,1fr)_110px_110px] items-center gap-x-4 border-b border-line py-3 md:grid-cols-[28px_minmax(0,1.4fr)_120px_120px_minmax(0,1fr)]">
                  <label className="check !items-center">
                    <input
                      type="checkbox"
                      checked={selected.has(r.iso2)}
                      onChange={(e) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(r.iso2);
                          else next.delete(r.iso2);
                          return next;
                        })
                      }
                      aria-label={`Select ${r.name}`}
                    />
                  </label>
                  <span className="flex min-w-0 items-center gap-3">
                    <CountryFlag iso2={r.iso2} className="h-[20px] w-[30px]" />
                    <span className="min-w-0">
                      <span className="block truncate text-[14.5px] font-semibold text-ink">{r.name}</span>
                      <span className="block text-[12px] text-muted">
                        {r.iso2} · {r.region}
                      </span>
                    </span>
                  </span>
                  {(["rdp", "vps"] as const).map((p) => (
                    <label key={p} className={`check !items-center ${!ready[p] ? "opacity-50" : ""}`}>
                      <input
                        type="checkbox"
                        checked={r[p]}
                        disabled={!ready[p] || pending}
                        onChange={(e) => apply([r.iso2], [p], e.target.checked)}
                        aria-label={`Windows ${p.toUpperCase()} in ${r.name}`}
                      />
                      <span>{r[p] ? "On sale" : "Off"}</span>
                    </label>
                  ))}
                  <span className="num-tabular hidden text-[13px] text-ink-2 md:block">
                    {r.rdp || r.vps ? (
                      <>
                        {r.rdp && r.rdpFrom !== null && <>RDP {formatUsd(r.rdpFrom)}</>}
                        {r.rdp && r.vps && r.rdpFrom !== null && r.vpsFrom !== null && " · "}
                        {r.vps && r.vpsFrom !== null && <>VPS {formatUsd(r.vpsFrom)}</>}
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line-2 bg-bg px-4 py-3 sm:px-8 lg:left-[248px]" role="region" aria-label="Apply to the selected countries">
          <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-4 gap-y-2">
            <p className="num-tabular text-[14px] font-medium text-ink" aria-live="polite">
              {selected.size} selected
            </p>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button size="sm" disabled={pending || !ready.rdp} onClick={() => apply([...selected], ["rdp"], true)}>
                Switch on RDP
              </Button>
              <Button size="sm" disabled={pending || !ready.vps} onClick={() => apply([...selected], ["vps"], true)}>
                Switch on VPS
              </Button>
              <Button size="sm" disabled={pending || !(ready.rdp && ready.vps)} onClick={() => apply([...selected], ["rdp", "vps"], true)}>
                Switch on both
              </Button>
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => apply([...selected], ["rdp", "vps"], false)}>
                Switch off both
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
