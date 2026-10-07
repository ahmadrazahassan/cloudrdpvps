import type { ReactNode } from "react";
import { Card } from "@/components/portal/cards";
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
 * A table in a white card: a pale header row, hairlines between rows, a soft wash on hover and focus, row height
 * from the console's density setting (44px compact / 56px comfortable). Real <table> markup, so headers, scope and
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
      <Card>
        <p className="px-6 py-16 text-center text-[14px] text-muted" role="status">
          {empty}
        </p>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      {/* `relative` here (on the scrolling element itself) keeps the screen-reader-only header text inside the clipped region. */}
      <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label={label}>
        <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr className="bg-surface-2">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    "label-caps h-11 whitespace-nowrap px-4 font-medium first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6",
                    c.align === "right" && "text-right",
                    c.hide && HIDE[c.hide],
                  )}
                >
                  {c.srOnlyHeader ? <span className="sr-only">{c.header}</span> : c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="ledger-row h-[var(--row-h)]" data-active={rowActive?.(row) || undefined}>
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-4 py-2 align-middle first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6", c.align === "right" && "text-right", c.hide && HIDE[c.hide], c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
