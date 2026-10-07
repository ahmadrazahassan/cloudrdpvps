import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardHeader, StatCard } from "@/components/portal/cards";
import { cn } from "@/lib/utils";

/**
 * Small pieces the admin console and the command palette share: status dots, keycaps, section cards, figures.
 * The console uses the same card surfaces as the customer dashboard (see components/portal/cards).
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
 * A titled card: the console's basic building block. Title on the left, an optional action or note on the
 * right. `flush` is for a list or table that runs edge to edge — the header gets a hairline and the body gets no
 * padding (rows bring their own, see RowList / Row in components/portal/cards).
 */
export function LedgerSection({
  title,
  aside,
  children,
  className,
  id,
  flush = false,
}: {
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  flush?: boolean;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <Card id={id} aria-labelledby={headingId} className={className}>
      <CardHeader
        headingId={headingId}
        divided={flush}
        title={title}
        action={typeof aside === "string" ? <span className="text-[13px] text-muted">{aside}</span> : aside}
        className={flush ? undefined : "pb-4"}
      />
      <div className={cn(!flush && "px-5 pb-6 sm:px-6")}>{children}</div>
    </Card>
  );
}

/** One headline number as a card tile — see StatCard. Pass `icon` to draw a bare icon in the corner. */
export function Figure({
  label,
  value,
  note,
  href,
  delta,
  tone = "default",
  icon,
  labelLines,
  className,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  href?: string;
  /** Percentage change versus the previous period; omit when there is nothing to compare. */
  delta?: number | null;
  tone?: "default" | "warn" | "bad";
  icon?: LucideIcon;
  labelLines?: 1 | 2;
  className?: string;
}) {
  return <StatCard label={label} value={value} note={note} href={href} delta={delta} tone={tone} icon={icon} labelLines={labelLines} className={className} />;
}

/** Label / value pairs separated by hairlines — details in a card or a narrow column. */
export function Facts({ items, className }: { items: { label: string; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-line", className)}>
      {items.map((it) => (
        <div key={it.label} className="flex items-baseline justify-between gap-6 py-3 first:pt-0 last:pb-0">
          <dt className="shrink-0 text-[14px] text-muted">{it.label}</dt>
          <dd className="min-w-0 break-words text-right text-[14px] font-medium text-ink">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
