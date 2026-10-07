import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Two small, server-rendered charts for the overview. Pure markup and SVG — no chart library, no
 * client JavaScript — and only real data goes in: nothing here invents a figure.
 */

export interface TermBar {
  id: string;
  /** Server name (shown under the bar and in its tooltip). */
  label: string;
  daysLeft: number;
  status: "active" | "expiring" | "expired" | "suspended";
  href: string;
  /** "Expires 12 Nov 2026" */
  caption: string;
}

const BAR_FILL: Record<TermBar["status"], string> = {
  active: "bg-lav-500",
  expiring: "bg-warn",
  expired: "bg-bad",
  suspended: "bg-line-2",
};

const STATUS_WORD: Record<TermBar["status"], string> = {
  active: "Active",
  expiring: "Expiring soon",
  expired: "Expired",
  suspended: "Suspended",
};

/** Legend dots for the colours TermChart uses. */
export function TermLegend() {
  const items: { tone: string; label: string }[] = [
    { tone: "bg-lav-500", label: "Active" },
    { tone: "bg-warn", label: "Expiring" },
    { tone: "bg-bad", label: "Expired" },
  ];
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted" aria-hidden>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", i.tone)} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

const PLOT_H = 208;

/**
 * Days left on each server, soonest first, as vertical bars on a light track — the same idea as a
 * "performance" chart, but about the thing a hosting customer actually watches: when each term ends.
 * Bars are links to the server. The first bar keeps its tooltip open until the pointer is on the chart.
 */
export function TermChart({ bars, termDays = 30 }: { bars: TermBar[]; termDays?: number }) {
  const ticks = [termDays, Math.round((termDays * 2) / 3), Math.round(termDays / 3), 0];

  return (
    <div className="group/chart" role="group" aria-label={`Days left on each server, out of ${termDays}`}>
      <div className="flex gap-3">
        {/* y axis */}
        <div aria-hidden className="relative w-9 shrink-0 text-right text-[12px] leading-none text-muted" style={{ height: PLOT_H }}>
          {ticks.map((t, i) => (
            <span key={t} className="num-tabular absolute right-0 -translate-y-1/2" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}>
              {t}d
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* gridlines */}
          <div aria-hidden className="absolute inset-x-0 top-0 flex flex-col justify-between" style={{ height: PLOT_H }}>
            {ticks.map((t, i) => (
              <span key={t} className={cn("block border-t", i === ticks.length - 1 ? "border-line-2" : "border-dashed border-line")} />
            ))}
          </div>

          <ul className="relative flex items-start justify-around gap-2 px-1 sm:gap-3 sm:px-2">
            {bars.map((b, i) => {
              const pct = Math.max(0.035, Math.min(1, b.daysLeft / termDays));
              const featured = i === 0;
              // Short bars: the tooltip sits above the bar. Tall bars have no room above, so it opens beside
              // the bar instead (to the left for the right half of the chart), never over the card heading.
              const beside = pct > 0.5;
              const flip = i >= bars.length / 2;
              return (
                <li key={b.id} className="min-w-0 max-w-[68px] flex-1">
                  <Link
                    href={b.href}
                    aria-label={`${b.label}: ${b.daysLeft === 0 ? "expired" : `${b.daysLeft} ${b.daysLeft === 1 ? "day" : "days"} left`}`}
                    className="group/bar block rounded-[10px] outline-offset-4"
                  >
                    <span className="relative block w-full" style={{ height: PLOT_H }}>
                      <span aria-hidden className="absolute inset-0 rounded-[10px] bg-surface-2" />
                      <span
                        aria-hidden
                        className={cn("absolute inset-x-0 bottom-0 rounded-[10px] transition-[filter] group-hover/bar:brightness-95", BAR_FILL[b.status])}
                        style={{ height: `${pct * 100}%` }}
                      />
                      <span
                        aria-hidden
                        role="presentation"
                        className={cn(
                          "pointer-events-none absolute z-20 w-max max-w-[220px] rounded-card border border-black/[0.06] bg-surface px-3.5 py-2.5 text-left opacity-0 shadow-2 transition-opacity",
                          "group-hover/bar:opacity-100 group-focus-visible/bar:opacity-100",
                          !beside && "left-1/2 -translate-x-1/2",
                          featured && "opacity-100 group-hover/chart:opacity-0 group-hover/bar:!opacity-100",
                        )}
                        style={
                          beside
                            ? { top: 8, ...(flip ? { right: "calc(100% + 8px)" } : { left: "calc(100% + 8px)" }) }
                            : { bottom: `calc(${pct * 100}% + 10px)` }
                        }
                      >
                        <span className="block truncate text-[13px] font-semibold text-ink">{b.label}</span>
                        <span className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-2">
                          <span className={cn("h-2 w-2 shrink-0 rounded-full", BAR_FILL[b.status])} />
                          {STATUS_WORD[b.status]}
                        </span>
                        <span className="num-tabular mt-1 block text-[12px] text-muted">
                          {b.daysLeft === 0 ? "Term ended" : `${b.daysLeft} ${b.daysLeft === 1 ? "day" : "days"} left`}
                        </span>
                        <span className="block text-[12px] text-muted">{b.caption}</span>
                      </span>
                    </span>
                    <span aria-hidden className="mt-3 block truncate text-center text-[12px] font-medium text-ink-2">
                      {b.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

const COLOR_STEPS = ["stroke-lav-600", "stroke-lav-400", "stroke-lav-300"] as const;

/**
 * A half-circle gauge drawn as separate rounded bars. The first `percent` of them are lavender, fading
 * lighter toward the end; the rest stay pale. The big number sits in the opening.
 */
export function HealthGauge({
  percent,
  caption,
  segments = 18,
  empty = false,
}: {
  /** 0–100. */
  percent: number;
  caption: string;
  segments?: number;
  /** Nothing to measure yet: draw the track only and show a dash. */
  empty?: boolean;
}) {
  const cx = 130;
  const cy = 130;
  const outer = 118;
  const inner = 82;
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = empty ? 0 : Math.round((clamped / 100) * segments);

  return (
    <figure className="relative mx-auto w-full max-w-[300px]">
      <svg viewBox="0 0 260 142" role="img" aria-label={empty ? caption : `${Math.round(clamped)}% — ${caption}`} className="block w-full">
        {Array.from({ length: segments }, (_, i) => {
          const a = Math.PI + (Math.PI * (i + 0.5)) / segments;
          const on = i < filled;
          const step = i / segments < 0.6 ? 0 : i / segments < 0.8 ? 1 : 2;
          return (
            <line
              key={i}
              x1={cx + inner * Math.cos(a)}
              y1={cy + inner * Math.sin(a)}
              x2={cx + outer * Math.cos(a)}
              y2={cy + outer * Math.sin(a)}
              strokeWidth={11}
              strokeLinecap="round"
              className={on ? COLOR_STEPS[step] : "stroke-lav-100"}
            />
          );
        })}
      </svg>
      <figcaption className="absolute inset-x-0 bottom-0 text-center">
        <span className="num-tabular block font-display text-[40px] font-[500] leading-none tracking-[-0.035em] text-ink">
          {empty ? "—" : `${Math.round(clamped)}%`}
        </span>
        <span className="mt-1.5 block text-[13px] text-muted">{caption}</span>
      </figcaption>
    </figure>
  );
}
