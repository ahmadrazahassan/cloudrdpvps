import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * "Ledger" — the shared visual language of the customer dashboard and the admin console.
 * Everything here is flat: hairlines, type, tiny dots and tick marks. No cards, no fills, no shadows.
 */

type SignalTone = "ok" | "warn" | "bad" | "lav" | "muted";

const SIGNAL: Record<SignalTone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
  lav: "text-lav-600",
  muted: "text-line-2",
};

/** An 8px status dot. `pulse` adds a slow outline ring for things that are live or need attention. */
export function Signal({
  tone = "lav",
  pulse = false,
  label,
  className,
}: {
  tone?: SignalTone;
  pulse?: boolean;
  /** Screen-reader text. Omit when the dot sits next to words that already say it. */
  label?: string;
  className?: string;
}) {
  return (
    <>
      <span aria-hidden className={cn("signal", SIGNAL[tone], className)} data-pulse={pulse || undefined} />
      {label && <span className="sr-only">{label}</span>}
    </>
  );
}

/** A keycap drawn with a hairline: `<Kbd>G</Kbd> <Kbd>P</Kbd>`. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-[5px] border border-line-2 px-1.5 font-sans text-[11px] font-medium leading-none text-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/**
 * A numbered section: `01  ACTION QUEUE ───────────  aside`.
 * The hairline above and the lavender index give pages a printed-ledger rhythm without any box.
 */
export function LedgerSection({
  n,
  title,
  aside,
  children,
  className,
  id,
}: {
  n?: number;
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("border-t border-line pb-10 pt-4", className)}>
      <header className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {n !== undefined && (
          <span aria-hidden className="num-tabular w-5 text-[12px] font-semibold text-lav-700">
            {String(n).padStart(2, "0")}
          </span>
        )}
        <h2 id={headingId} className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink">
          {title}
        </h2>
        {aside && <div className="ml-auto text-[13px] text-muted">{aside}</div>}
      </header>
      {children}
    </section>
  );
}

/** One large number with a small caption, optionally a link and a change-vs-before marker. */
export function Figure({
  label,
  value,
  note,
  href,
  delta,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  href?: string;
  /** Percentage change versus the previous period; omit when there is nothing to compare. */
  delta?: number | null;
  tone?: "default" | "warn" | "bad";
  className?: string;
}) {
  const body = (
    <>
      <p className="label-caps">{label}</p>
      <p
        className={cn(
          "num-tabular mt-3 font-display text-[40px] font-[450] leading-none tracking-[-0.035em] md:text-[46px]",
          tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "text-ink",
        )}
      >
        {value}
      </p>
      <p className="mt-3 flex min-h-[20px] items-center gap-2 text-[13px] text-muted">
        {typeof delta === "number" && Number.isFinite(delta) && (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", delta >= 0 ? "text-ok" : "text-bad")}>
            {delta >= 0 ? <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden /> : <ArrowDownRight size={14} strokeWidth={1.75} aria-hidden />}
            {Math.abs(delta).toFixed(0)}%
            <span className="sr-only"> versus the previous period</span>
          </span>
        )}
        {note}
      </p>
    </>
  );
  const base = cn("block min-w-0 px-5 py-5 first:pl-0", className);
  return href ? (
    <Link href={href} className={cn(base, "ledger-row group transition-colors hover:bg-black/[0.02]")}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}

/** Label / value pairs separated by hairlines — the replacement for "summary cards" in detail rails. */
export function Facts({ items, className }: { items: { label: string; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-line border-y border-line", className)}>
      {items.map((it) => (
        <div key={it.label} className="flex items-baseline justify-between gap-6 py-2.5">
          <dt className="shrink-0 text-[13px] text-muted">{it.label}</dt>
          <dd className="min-w-0 break-words text-right text-[14px] font-medium text-ink">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
