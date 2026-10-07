import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Search, type LucideIcon } from "lucide-react";
import type { ComponentProps, ElementType, ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The customer dashboard's surface system: white cards on the #F1F1F1 page.
 *
 *   spacing   cards sit 20px apart (16px on phones); a card's content sits 24px in (20px on phones)
 *   shape     20px radius (--radius-panel), a hairline at 6% black and the softest shadow
 *   icons     always bare — drawn straight on the card, never inside a chip, circle or tile
 *   colour    ink on white, lavender as the accent; solid fills only (gradients stay in buttons.css)
 *
 * Everything here renders on the server; the few interactive bits (tabs are plain links) need no JavaScript.
 */

/** Horizontal padding every card row shares, so headings, rows and footers line up on one edge. */
export const CARD_X = "px-5 sm:px-6";

/** The card surface. No padding of its own: pass `padded`, or lay out header / rows / footer with CARD_X. */
export function Card({
  as,
  padded = false,
  className,
  children,
  ...rest
}: { as?: "section" | "div" | "aside" | "article"; padded?: boolean } & Omit<ComponentProps<"section">, "ref">) {
  const Tag: ElementType = as ?? "section";
  return (
    <Tag
      className={cn("rounded-panel border border-black/[0.06] bg-surface shadow-1", padded && "p-5 sm:p-6", className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Title line of a card: heading and one muted sentence on the left, an action on the right. */
export function CardHeader({
  title,
  description,
  action,
  divided = false,
  as: Heading = "h2",
  headingId,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** A hairline under the header, for cards whose body is a list or table. */
  divided?: boolean;
  as?: "h2" | "h3";
  /** id for the heading, so a group inside the card can be `aria-labelledby` it. */
  headingId?: string;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-5",
        CARD_X,
        divided && "border-b border-line",
        className,
      )}
    >
      <div className="min-w-0">
        <Heading id={headingId} className="font-display text-[17px] font-semibold leading-snug tracking-[-0.016em] text-ink">{title}</Heading>
        {description && <p className="mt-1 text-[14px] leading-relaxed text-muted">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2 text-[14px]">{action}</div>}
    </header>
  );
}

/** "View all" and friends: a quiet lavender link with an arrow, sized for a card header. */
export function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-[14px] font-medium text-lav-700 transition-colors hover:text-lav-900"
    >
      {children}
      <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden />
    </Link>
  );
}

/** Column heads of a table card. Hidden on phones, where each row stacks into its own block. */
export function TableHead({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div aria-hidden className={cn("label-caps hidden items-center gap-6 bg-surface-2 py-3 md:grid", CARD_X, className)}>
      {children}
    </div>
  );
}

/** The rows under a TableHead (or a CardHeader): hairlines between, a soft hover wash. */
export function RowList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("divide-y divide-line", className)}>{children}</ul>;
}

/** A single row. Pass the grid columns in `className` (e.g. `md:grid-cols-[1.2fr_1fr_auto]`). */
export function Row({ className, children, ...rest }: ComponentProps<"li">) {
  return (
    <li
      className={cn("grid gap-x-6 gap-y-3 py-4 transition-colors hover:bg-surface-2/70 md:items-center", CARD_X, className)}
      {...rest}
    >
      {children}
    </li>
  );
}

type StatTone = "default" | "primary" | "warn" | "bad";

/**
 * One headline number. `primary` is the single solid-lavender card of the row (the page's focal point);
 * the others are white. The icon is drawn bare in the top-right corner. With `href` the whole card links.
 */
export function StatCard({
  label,
  value,
  note,
  icon: Icon,
  href,
  tone = "default",
  delta,
  labelLines = 1,
  className,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  /** Drawn bare in the top-right corner. Optional: a tile without one is just a label and a number. */
  icon?: LucideIcon;
  href?: string;
  tone?: StatTone;
  /** Percentage change versus the previous period; omit when there is nothing to compare. */
  delta?: number | null;
  /** Reserve room for a two-line label so a row of tiles keeps its numbers on one line when a label wraps. */
  labelLines?: 1 | 2;
  className?: string;
}) {
  const primary = tone === "primary";
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const body = (
    <>
      <div className="flex items-start justify-between gap-4">
        <p className={cn("text-[14px] font-medium", primary ? "text-white" : "text-ink-2", "leading-[21px]", labelLines === 2 && "min-h-[42px]")}>{label}</p>
        {Icon && (
          <Icon
            size={22}
            strokeWidth={1.5}
            aria-hidden
            className={cn("shrink-0", primary ? "text-white" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "text-lav-600")}
          />
        )}
      </div>
      <p
        className={cn(
          "num-tabular mt-5 font-display text-[42px] font-[500] leading-none tracking-[-0.035em]",
          primary ? "text-white" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "text-ink",
        )}
      >
        {value}
      </p>
      <p className={cn("mt-3 flex min-h-[20px] flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] leading-snug", primary ? "text-white/90" : "text-muted")}>
        {hasDelta && (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", primary ? "text-white" : delta! >= 0 ? "text-ok" : "text-bad-ink")}>
            {delta! >= 0 ? <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden /> : <ArrowDownRight size={14} strokeWidth={1.75} aria-hidden />}
            {Math.abs(delta!).toFixed(0)}%<span className="sr-only"> versus the previous period</span>
          </span>
        )}
        {note}
      </p>
    </>
  );

  const surface = cn(
    "block min-w-0 rounded-panel border p-5 shadow-1 sm:p-6",
    primary ? "border-lav-700 bg-lav-600" : "border-black/[0.06] bg-surface",
    className,
  );
  return href ? (
    <Link
      href={href}
      className={cn(
        surface,
        "transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-2 focus-visible:outline-offset-4",
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={surface}>{body}</div>
  );
}

/**
 * Section tabs as plain links (the URL is the state, so they work without JavaScript and can be shared).
 * A white track with the current tab filled in lavender; scrolls sideways on narrow screens.
 */
export function Tabs({
  items,
  current,
  hrefFor,
  label,
  className,
  variant = "page",
}: {
  items: { id: string; label: string; count?: number }[];
  current: string;
  hrefFor: (id: string) => string;
  label: string;
  className?: string;
  /** "page": a white track on the grey page. "inset": a grey track, for tabs that sit inside a white card. */
  variant?: "page" | "inset";
}) {
  return (
    <nav aria-label={label} className={cn("max-w-full overflow-x-auto", className)}>
      <ul
        className={cn(
          "inline-flex min-w-max gap-1 rounded-card p-1",
          variant === "page" ? "border border-black/[0.06] bg-surface shadow-1" : "bg-bg",
        )}
      >
        {items.map((it) => {
          const active = it.id === current;
          return (
            <li key={it.id}>
              <Link
                href={hrefFor(it.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-[10px] px-4 text-[14px] font-medium transition-colors",
                  active ? "bg-lav-600 text-white" : variant === "page" ? "text-ink-2 hover:bg-bg hover:text-ink" : "text-ink-2 hover:bg-black/[0.05] hover:text-ink",
                )}
              >
                {it.label}
                {it.count !== undefined && (
                  <span className={cn("num-tabular text-[12px]", active ? "text-white/90" : "text-muted")}>{it.count}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** "Page 2 of 5" with previous/next, in the footer of a list card. Renders nothing for a single page. */
export function PagerBar({
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
    <nav aria-label="Pagination" className={cn("flex items-center justify-between gap-4 border-t border-line py-4", CARD_X)}>
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

/** Label / value tiles for details that read as a set (a server's login, a payment's facts). */
export function FactGrid({
  items,
  className,
}: {
  items: { label: string; value: ReactNode; wide?: boolean }[];
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-3 sm:grid-cols-2", className)}>
      {items.map((it) => (
        <div key={it.label} className={cn("min-w-0 rounded-card bg-surface-2 px-4 py-3.5", it.wide && "sm:col-span-2")}>
          <dt className="text-[12px] font-medium text-muted">{it.label}</dt>
          <dd className="data-id mt-1 min-w-0 break-words text-[15px] font-medium text-ink">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Label / value lines separated by hairlines, for summaries that sit in a narrow column. */
export function SummaryList({ items, className }: { items: { label: string; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-line", className)}>
      {items.map((it) => (
        <div key={it.label} className="flex items-baseline justify-between gap-6 py-3">
          <dt className="shrink-0 text-[14px] text-muted">{it.label}</dt>
          <dd className="num-tabular min-w-0 break-words text-right text-[14px] font-medium text-ink">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A GET search form for list pages (the query lands in the URL, so it can be shared). White field,
 * the magnifier drawn bare inside it. `keep` carries the current filter through as hidden inputs.
 */
export function SearchForm({
  action,
  id,
  label,
  placeholder,
  defaultValue,
  keep,
}: {
  action: string;
  id: string;
  label: string;
  placeholder: string;
  defaultValue?: string;
  keep?: Record<string, string | null | undefined>;
}) {
  return (
    <form method="get" action={action} role="search" className="flex items-center gap-2">
      {Object.entries(keep ?? {}).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <Search size={16} strokeWidth={1.5} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          id={id}
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder={placeholder}
          autoComplete="off"
          className="field-input !h-11 !w-[min(240px,52vw)] !rounded-card !border-black/[0.08] !bg-surface !pl-10 !text-[14px]"
        />
      </div>
      <Button type="submit" variant="secondary" size="sm" className="!h-11">
        Search
      </Button>
    </form>
  );
}
