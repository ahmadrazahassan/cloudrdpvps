import { formatUsd } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Charts drawn with plain elements: solid lavender fills, soft rounded bars, hairline gridlines, tabular numbers.
 * No chart library and no gradients — they sit inside the console's white cards.
 */

const shortDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** One thin bar per day (a ruler of revenue). Hover a bar for the exact day and amount. */
export function DayBars({ points, label }: { points: { day: string; cents: number }[]; label: string }) {
  const max = Math.max(1, ...points.map((p) => p.cents));
  const total = points.reduce((s, p) => s + p.cents, 0);
  const peak = points.reduce((best, p) => (p.cents > best.cents ? p : best), points[0] ?? { day: "", cents: 0 });
  const grid = [1, 0.5, 0];

  return (
    <figure>
      <figcaption className="sr-only">
        {label}: {formatUsd(total)} in total{total > 0 ? `, highest on ${shortDay(peak.day)} at ${formatUsd(peak.cents)}` : ""}.
      </figcaption>
      <div className="flex gap-3" aria-hidden>
        <div className="relative h-[168px] w-12 shrink-0">
          {grid.map((g) => (
            <span key={g} className="num-tabular absolute right-0 -translate-y-1/2 text-[11px] text-muted" style={{ top: `${(1 - g) * 100}%` }}>
              {g === 0 ? "$0" : formatUsd(Math.round((max * g) / 100) * 100, { cents: false })}
            </span>
          ))}
        </div>
        <div className="relative h-[168px] min-w-0 flex-1">
          {grid.map((g) => (
            <span key={g} className="absolute inset-x-0 border-t border-line" style={{ top: `${(1 - g) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[3px]">
            {points.map((p) => (
              <span
                key={p.day}
                title={`${shortDay(p.day)} · ${formatUsd(p.cents)}`}
                className={cn("min-w-[2px] flex-1 rounded-t-[3px] transition-colors", p.cents > 0 ? "bg-lav-400 hover:bg-lav-600" : "bg-line")}
                style={{ height: p.cents > 0 ? `${Math.max(2, (p.cents / max) * 100)}%` : "1px" }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex justify-between pl-[60px] text-[11px] text-muted" aria-hidden>
        <span>{points[0] ? shortDay(points[0].day) : ""}</span>
        <span>{points[Math.floor(points.length / 2)] ? shortDay(points[Math.floor(points.length / 2)]!.day) : ""}</span>
        <span>{points.at(-1) ? shortDay(points.at(-1)!.day) : ""}</span>
      </div>
    </figure>
  );
}

/** Ranked horizontal bars with the count at the right. */
export function BarList({ items, empty = "No data in this range.", unit = "" }: { items: { label: string; count: number }[]; empty?: string; unit?: string }) {
  if (items.length === 0) return <p className="py-3 text-[14px] text-muted">{empty}</p>;
  const max = Math.max(...items.map((i) => i.count));
  return (
    <ul className="space-y-4">
      {items.map((i) => (
        <li key={i.label}>
          <div className="flex items-baseline justify-between gap-4 text-[13.5px]">
            <span className="min-w-0 truncate text-ink">{i.label}</span>
            <span className="num-tabular shrink-0 font-semibold text-ink">
              {i.count}
              {unit}
            </span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-lav-100" aria-hidden>
            <div className="h-full rounded-full bg-lav-500" style={{ width: `${Math.max(3, (i.count / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A single bar split into labelled segments (e.g. RDP vs VPS). */
export function SplitBar({ items }: { items: { label: string; count: number }[] }) {
  const total = items.reduce((s, i) => s + i.count, 0);
  if (total === 0) return <p className="py-3 text-[14px] text-muted">No orders in this range.</p>;
  const shades = ["bg-lav-600", "bg-lav-300", "bg-lav-200"];
  return (
    <div>
      <div className="flex h-3 gap-[3px]" role="img" aria-label={items.map((i) => `${i.label} ${i.count}`).join(", ")}>
        {items.map((i, n) => (
          <span key={i.label} className={cn("h-full first:rounded-l-full last:rounded-r-full", shades[n % shades.length])} style={{ width: `${(i.count / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13.5px]">
        {items.map((i, n) => (
          <li key={i.label} className="flex items-center gap-2">
            <span aria-hidden className={cn("h-2 w-2 rounded-full", shades[n % shades.length])} />
            <span className="text-ink">{i.label}</span>
            <span className="num-tabular font-semibold text-ink">{i.count}</span>
            <span className="num-tabular text-muted">{Math.round((i.count / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
