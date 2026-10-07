import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "right";
  /** Hide this column below a breakpoint (the table scrolls sideways for the rest). */
  hide?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Visually hide the header text (for action columns) but keep it for screen readers. */
  srOnlyHeader?: boolean;
}

const HIDE = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" } as const;

/**
 * A dense, flat table: hairline rows, a lavender rail on hover and focus, row height from the
 * console's density setting (36px compact / 48px comfortable). Real <table> markup, so headers, scope and
 * keyboard reading work as expected; wide tables scroll inside a labelled, focusable region.
 * Put an `<a data-row-link>` in a row's first cell and J / K move between rows.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  label,
  empty = "Nothing here yet.",
  rowActive,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Accessible name of the table. */
  label: string;
  empty?: ReactNode;
  rowActive?: (row: T) => boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="border-y border-line py-14 text-center text-[14px] text-muted" role="status">
        {empty}
      </div>
    );
  }
  return (
    <div>
      {/* `relative` here (on the scrolling element itself) keeps the screen-reader-only header text inside the clipped region. */}
      <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label={label}>
        <table className="w-full min-w-[640px] border-collapse text-left text-[13.5px]">
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr className="border-b border-line-2">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    "label-caps h-9 whitespace-nowrap px-3 font-medium",
                    c.align === "right" && "text-right",
                    c.hide && HIDE[c.hide],
                  )}
                >
                  {c.srOnlyHeader ? <span className="sr-only">{c.header}</span> : c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="ledger-row h-[var(--row-h)] border-b border-line transition-colors hover:bg-black/[0.015]" data-active={rowActive?.(row) || undefined}>
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-3 py-1.5 align-middle", c.align === "right" && "text-right", c.hide && HIDE[c.hide], c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
