import Link from "next/link";
import type { ReactNode } from "react";
import { formatDateTime, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { displayName, type ProfileLite } from "@/lib/admin/db";

/** Page title block for console screens: smaller and denser than the customer dashboard's. */
export function AdminHeader({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-7", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.024em] text-ink md:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-[70ch] text-[14px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

/** "3 hours ago", with the exact UTC time on hover. Server-rendered from the request time so it never mismatches. */
export function Ago({ value, nowMs, className }: { value: string; nowMs: number; className?: string }) {
  return (
    <time dateTime={value} title={`${formatDateTime(value)} UTC`} className={cn("whitespace-nowrap", className)}>
      {relativeTime(value, nowMs)}
    </time>
  );
}

/** Customer name linking to their console page, with the email underneath when asked. */
export function CustomerLink({ customer, showEmail = false, className }: { customer: Pick<ProfileLite, "id" | "email" | "full_name"> | null | undefined; showEmail?: boolean; className?: string }) {
  if (!customer) return <span className="text-muted">Unknown customer</span>;
  return (
    <span className={cn("block min-w-0", className)}>
      <Link href={`/admin/customers/${customer.id}`} className="block truncate font-medium text-ink hover:text-lav-700">
        {displayName(customer)}
      </Link>
      {showEmail && customer.full_name.trim() && <span className="block truncate text-[12px] text-muted">{customer.email}</span>}
    </span>
  );
}

/** IPs, order numbers and ports: tabular figures, never wrapped. */
export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("data-id whitespace-nowrap", className)}>{children}</span>;
}

/** A GET search box. The URL is the state, so results are shareable and it works without JavaScript. */
export function SearchBox({ action, q, keep, placeholder = "Search", label = "Search" }: { action: string; q?: string; keep?: Record<string, string | undefined>; placeholder?: string; label?: string }) {
  return (
    <form action={action} method="get" role="search" className="flex w-full max-w-[360px] items-center">
      {Object.entries(keep ?? {}).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <label htmlFor="list-search" className="sr-only">
        {label}
      </label>
      <input
        id="list-search"
        name="q"
        type="search"
        defaultValue={q ?? ""}
        placeholder={placeholder}
        autoComplete="off"
        className="h-9 w-full rounded-btn border border-line-2 bg-transparent px-3 text-[14px] text-ink outline-none transition-colors placeholder:text-muted hover:border-muted focus:border-lav-600 focus:outline-2 focus:outline-offset-1 focus:outline-lav-500"
      />
    </form>
  );
}

export interface FilterSelect {
  name: string;
  label: string;
  value?: string;
  options: { value: string; label: string }[];
  /** Label of the "no filter" choice. */
  all?: string;
}

/** Search + dropdown filters as a plain GET form. The URL is the state; "Apply" submits (Enter works too). */
export function FilterBar({ action, q, keep, selects = [], placeholder = "Search", children }: { action: string; q?: string; keep?: Record<string, string | undefined>; selects?: FilterSelect[]; placeholder?: string; children?: ReactNode }) {
  return (
    <form action={action} method="get" role="search" className="flex flex-wrap items-center gap-2.5">
      {Object.entries(keep ?? {}).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <label htmlFor="filter-q" className="sr-only">
        Search
      </label>
      <input
        id="filter-q"
        name="q"
        type="search"
        defaultValue={q ?? ""}
        placeholder={placeholder}
        autoComplete="off"
        className="h-9 min-w-[200px] flex-1 rounded-btn border border-line-2 bg-transparent px-3 text-[14px] text-ink outline-none transition-colors placeholder:text-muted hover:border-muted focus:border-lav-600 focus:outline-2 focus:outline-offset-1 focus:outline-lav-500 sm:max-w-[320px]"
      />
      {selects.map((s) => (
        <span key={s.name} className="contents">
          <label htmlFor={`filter-${s.name}`} className="sr-only">
            {s.label}
          </label>
          <select
            id={`filter-${s.name}`}
            name={s.name}
            defaultValue={s.value ?? ""}
            className="h-9 rounded-btn border border-line-2 bg-transparent px-2.5 text-[14px] text-ink outline-none transition-colors hover:border-muted focus:border-lav-600 focus:outline-2 focus:outline-offset-1 focus:outline-lav-500"
          >
            <option value="">{s.all ?? s.label}</option>
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </span>
      ))}
      {children}
      <button type="submit" className="h-9 rounded-btn px-3 text-[14px] font-medium text-lav-700 transition-colors hover:bg-black/[0.04]">
        Apply
      </button>
    </form>
  );
}

/** A quiet empty block for lists with nothing in them. */
export function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="border-y border-line py-12 text-center text-[14px] text-muted">{children}</p>;
}

/** Key facts for a list header: "42 results". */
export function ResultCount({ total, noun }: { total: number; noun: string }) {
  return (
    <p className="num-tabular text-[13px] text-muted" aria-live="polite">
      {total.toLocaleString("en-US")} {total === 1 ? noun : `${noun}s`}
    </p>
  );
}
