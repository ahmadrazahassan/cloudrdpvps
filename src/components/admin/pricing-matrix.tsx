"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { savePricing } from "@/lib/admin/actions/catalog";
import { centsToInput, parseUsdToCents } from "@/lib/admin/money";
import type { Location, Plan, PlanPricing } from "@/lib/admin/queries-system";
import { formatUsd } from "@/lib/utils";

interface Cell {
  price: string;
  stock: "in_stock" | "low" | "out_of_stock";
  stockCount: string;
  active: boolean;
  exists: boolean;
}

const key = (planId: string, locationId: string) => `${planId}:${locationId}`;
const STOCK = [
  { value: "in_stock", label: "In stock" },
  { value: "low", label: "Low" },
  { value: "out_of_stock", label: "Out" },
];

function fromRow(p: PlanPricing): Cell {
  return { price: centsToInput(p.price_cents), stock: p.stock, stockCount: p.stock_count == null ? "" : String(p.stock_count), active: p.is_active, exists: true };
}
const empty = (): Cell => ({ price: "", stock: "in_stock", stockCount: "", active: true, exists: false });
const same = (a: Cell | undefined, b: Cell) => !!a && a.price === b.price && a.stock === b.stock && a.stockCount === b.stockCount && a.active === b.active;

/**
 * The pricing & stock grid: plans down the side, locations across the top; each cell is a price, a stock
 * state and an on/off switch. Edits stay in the browser until "Save all", which writes only the cells you changed
 * (each one is audited with its old and new values) and refreshes the public site. Bulk tools adjust prices by a percentage.
 */
export function PricingMatrix({ plans, locations, pricing }: { plans: Plan[]; locations: Location[]; pricing: PlanPricing[] }) {
  const original = useMemo(() => {
    const m = new Map<string, Cell>();
    for (const p of pricing) m.set(key(p.plan_id, p.location_id), fromRow(p));
    return m;
  }, [pricing]);

  const [cells, setCells] = useState<Map<string, Cell>>(() => new Map(original));
  const [percent, setPercent] = useState("");
  const [scope, setScope] = useState<"all" | "rdp" | "vps">("all");
  // With many countries on sale the grid would be a mile wide: show the first few, or whichever the search matches.
  const [countryQuery, setCountryQuery] = useState("");
  const COLUMN_LIMIT = 8;
  const visible = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    const hit = q ? locations.filter((l) => l.name.toLowerCase().includes(q) || l.iso2.trim().toLowerCase() === q) : locations;
    return q || hit.length <= COLUMN_LIMIT ? hit : hit.slice(0, COLUMN_LIMIT);
  }, [locations, countryQuery]);
  const [review, setReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const get = (p: string, l: string) => cells.get(key(p, l));
  const patch = (p: string, l: string, change: Partial<Cell>) =>
    setCells((prev) => {
      const next = new Map(prev);
      next.set(key(p, l), { ...(prev.get(key(p, l)) ?? empty()), ...change });
      return next;
    });

  const dirty = useMemo(() => {
    const out: { planId: string; locationId: string; cell: Cell }[] = [];
    for (const plan of plans) {
      for (const loc of locations) {
        const cell = cells.get(key(plan.id, loc.id));
        if (!cell || cell.price.trim() === "") continue; // an empty price is "not offered here"
        if (!same(original.get(key(plan.id, loc.id)), cell)) out.push({ planId: plan.id, locationId: loc.id, cell });
      }
    }
    return out;
  }, [cells, original, plans, locations]);

  const bad = dirty.filter((d) => parseUsdToCents(d.cell.price) === null);

  function adjust() {
    const pct = Number(percent);
    if (!Number.isFinite(pct) || pct === 0 || Math.abs(pct) > 90) return setError("Enter a percentage between −90 and 90, e.g. 10 or -5.");
    setError(null);
    setCells((prev) => {
      const next = new Map(prev);
      for (const plan of plans) {
        if (scope !== "all" && plan.product !== scope) continue;
        for (const loc of locations) {
          const c = prev.get(key(plan.id, loc.id));
          const cents = c ? parseUsdToCents(c.price) : null;
          if (!c || cents === null) continue;
          next.set(key(plan.id, loc.id), { ...c, price: centsToInput(Math.max(1, Math.round((cents * (100 + pct)) / 100))) });
        }
      }
      return next;
    });
  }

  function save() {
    setError(null);
    setSaved(null);
    start(async () => {
      const r = await savePricing({
        changes: dirty.map((d) => ({ planId: d.planId, locationId: d.locationId, price: d.cell.price, stock: d.cell.stock, stockCount: d.cell.stockCount, active: d.cell.active })),
      });
      if (r.ok) {
        setSaved(r.data.saved);
        setReview(false);
      } else setError(r.fieldErrors?.changes?.[0] ?? r.message);
    });
  }

  const input = "h-8 w-[78px] rounded-btn border border-line-2 bg-transparent px-2 text-[13.5px] text-ink outline-none hover:border-muted focus:border-lav-600 num-tabular";
  const select = "h-8 rounded-btn border border-line-2 bg-transparent px-1.5 text-[12.5px] text-ink-2 outline-none hover:border-muted focus:border-lav-600";

  return (
    <div className="pb-28">
      <div className="mb-6 flex flex-wrap items-end gap-3 border-y border-line py-4">
        <p className="label-caps mr-2 self-center">Bulk adjust</p>
        <div>
          <label htmlFor="bulk-scope" className="sr-only">
            Products to adjust
          </label>
          <select id="bulk-scope" value={scope} onChange={(e) => setScope(e.target.value as "all")} className="h-9 rounded-btn border border-line-2 bg-transparent px-2.5 text-[14px] outline-none focus:border-lav-600">
            <option value="all">All plans</option>
            <option value="rdp">RDP plans</option>
            <option value="vps">VPS plans</option>
          </select>
        </div>
        <div>
          <label htmlFor="bulk-pct" className="sr-only">
            Percent change
          </label>
          <input id="bulk-pct" value={percent} onChange={(e) => setPercent(e.target.value)} inputMode="decimal" placeholder="± %" className="h-9 w-[84px] rounded-btn border border-line-2 bg-transparent px-2.5 text-[14px] outline-none focus:border-lav-600" />
        </div>
        <Button size="sm" variant="secondary" onClick={adjust}>
          Apply to prices
        </Button>
        <p className="text-[13px] text-muted">Changes stay in this page until you save.</p>
        {locations.length > COLUMN_LIMIT && (
          <div className="ml-auto">
            <label htmlFor="grid-country" className="sr-only">
              Find a country in the grid
            </label>
            <input id="grid-country" type="search" value={countryQuery} onChange={(e) => setCountryQuery(e.target.value)} placeholder={`Find a country (${locations.length})`} className="h-9 w-[220px] rounded-btn border border-line-2 bg-transparent px-2.5 text-[14px] outline-none focus:border-lav-600" />
          </div>
        )}
      </div>
      {locations.length > COLUMN_LIMIT && (
        <p className="-mt-3 mb-5 text-[13px] text-muted" aria-live="polite">
          {countryQuery.trim() ? `${visible.length} of ${locations.length} countries match.` : `Showing the first ${visible.length} of ${locations.length} countries. Search to see another one.`} Edits in countries you don&apos;t see are kept.
        </p>
      )}

      <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label="Pricing and stock grid">
        <table className="w-full min-w-[820px] border-collapse text-left text-[13.5px]">
          <caption className="sr-only">Price, stock and availability for every plan in every location</caption>
          <thead>
            <tr className="border-b border-line-2">
              <th scope="col" className="label-caps h-9 min-w-[170px] px-3 font-medium">
                Plan
              </th>
              {visible.map((l) => (
                <th key={l.id} scope="col" className="label-caps h-9 min-w-[150px] px-3 font-medium">
                  {l.name}
                  {!l.is_active && <span className="ml-1 normal-case tracking-normal text-warn">(off)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-b border-line align-top">
                <th scope="row" className="px-3 py-3 text-left font-normal">
                  <span className="block font-semibold text-ink">{plan.name}</span>
                  <span className="block text-[12px] text-muted">
                    {plan.product.toUpperCase()} · {plan.vcpu} vCPU · {plan.ram_gb} GB{!plan.is_active && " · off"}
                  </span>
                </th>
                {visible.map((loc) => {
                  const c = get(plan.id, loc.id);
                  const changed = !!c && c.price.trim() !== "" && !same(original.get(key(plan.id, loc.id)), c);
                  const invalid = !!c && c.price.trim() !== "" && parseUsdToCents(c.price) === null;
                  return (
                    <td key={loc.id} className={`px-3 py-3 ${changed ? "border-l-2 border-l-lav-500" : ""}`}>
                      {c ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span aria-hidden className="text-muted">
                              $
                            </span>
                            <input
                              aria-label={`${plan.name} price in ${loc.name}`}
                              aria-invalid={invalid || undefined}
                              value={c.price}
                              onChange={(e) => patch(plan.id, loc.id, { price: e.target.value })}
                              inputMode="decimal"
                              className={`${input} ${invalid ? "!border-bad" : ""}`}
                            />
                          </div>
                          <select aria-label={`${plan.name} stock in ${loc.name}`} value={c.stock} onChange={(e) => patch(plan.id, loc.id, { stock: e.target.value as Cell["stock"] })} className={select}>
                            {STOCK.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                          <label className="check !items-center !gap-1.5 text-[12.5px]">
                            <input type="checkbox" className="!mt-0" checked={c.active} onChange={(e) => patch(plan.id, loc.id, { active: e.target.checked })} />
                            <span>Offered</span>
                          </label>
                        </div>
                      ) : (
                        <button type="button" onClick={() => patch(plan.id, loc.id, { price: "" })} className="text-[13px] font-medium text-lav-700 hover:text-lav-900">
                          + Add price
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {saved !== null && (
        <p role="status" className="form-note mt-6" data-tone="ok">
          Saved {saved} price{saved === 1 ? "" : "s"}. The public site is updated.
        </p>
      )}

      {(dirty.length > 0 || error) && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line-2 bg-bg px-4 py-3 sm:px-8 lg:left-[248px]" role="region" aria-label="Unsaved pricing changes">
          {review && (
            <ul className="mx-auto mb-3 max-h-[28vh] max-w-[1360px] divide-y divide-line overflow-y-auto border-b border-line text-[13.5px]">
              {dirty.map((d) => {
                const plan = plans.find((p) => p.id === d.planId)!;
                const loc = locations.find((l) => l.id === d.locationId)!;
                const was = original.get(key(d.planId, d.locationId));
                const nowCents = parseUsdToCents(d.cell.price);
                return (
                  <li key={key(d.planId, d.locationId)} className="flex flex-wrap items-baseline gap-x-4 py-1.5">
                    <span className="min-w-[220px] font-medium text-ink">
                      {plan.name} · {loc.name}
                    </span>
                    <span className="num-tabular text-ink-2">
                      {was ? formatUsd(parseUsdToCents(was.price) ?? 0, { cents: true }) : "new"} → {nowCents === null ? <span className="text-bad">invalid</span> : formatUsd(nowCents, { cents: true })}
                    </span>
                    {was && was.stock !== d.cell.stock && (
                      <span className="text-muted">
                        stock {was.stock.replace("_", " ")} → {d.cell.stock.replace("_", " ")}
                      </span>
                    )}
                    {was && was.active !== d.cell.active && <span className="text-muted">{d.cell.active ? "switched on" : "switched off"}</span>}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-5 gap-y-2">
            <p className="num-tabular text-[14px] font-medium text-ink" aria-live="polite">
              {dirty.length} unsaved change{dirty.length === 1 ? "" : "s"}
            </p>
            {error && (
              <p role="alert" className="field-error !mt-0">
                {error}
              </p>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setReview((r) => !r)} disabled={dirty.length === 0}>
                {review ? "Hide review" : "Review"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setCells(new Map(original));
                  setError(null);
                  setReview(false);
                }}
              >
                Discard
              </Button>
              <Button size="sm" onClick={save} loading={pending} disabled={dirty.length === 0 || bad.length > 0}>
                Save all
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
