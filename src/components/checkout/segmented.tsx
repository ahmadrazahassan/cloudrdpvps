"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** A second, smaller line (a price, "Out of stock"). */
  sub?: ReactNode;
  /** Can't be chosen. It stays visible and tapping it calls `onBlocked`, so the reason can be shown. */
  unavailable?: boolean;
  /** Spoken name when the visible label alone isn't enough. */
  accessibleName?: string;
}

/**
 * A segmented control — a row of tabs in one track. The chosen segment is a raised white pill with bold text, so what is
 * selected is obvious at a glance; the rest sit flat on the track. Built on native radio buttons: arrow keys, focus and screen
 * readers behave as the browser already does.
 */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  onBlocked,
  options,
  className,
  size = "md",
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  onBlocked?: (value: T) => void;
  options: SegmentOption<T>[];
  className?: string;
  size?: "md" | "lg";
}) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid gap-1 rounded-[14px] bg-black/[0.05] p-1", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <label key={o.value} className={cn("relative block min-w-0", o.unavailable ? "cursor-not-allowed" : "cursor-pointer")}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={checked}
              aria-disabled={o.unavailable || undefined}
              aria-label={o.accessibleName}
              onChange={() => (o.unavailable ? onBlocked?.(o.value) : onChange(o.value))}
              className="peer absolute inset-0 h-full w-full cursor-[inherit] opacity-0"
            />
            <span
              className={cn(
                "flex h-full min-w-0 flex-col items-center justify-center rounded-[10px] px-2 text-center transition-all duration-150",
                size === "lg" ? "min-h-[64px] py-3" : "min-h-[48px] py-2.5",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-lav-500",
                checked
                  ? "bg-white text-ink shadow-[0_1px_2px_rgb(18_18_20/0.1),0_0_0_1px_rgb(18_18_20/0.05)]"
                  : o.unavailable
                    ? "text-muted"
                    : "text-ink-2 hover:bg-white/60 hover:text-ink",
              )}
            >
              <span className={cn("truncate text-[14px] leading-tight", checked ? "font-semibold" : "font-medium", o.unavailable && "line-through decoration-line-2")}>{o.label}</span>
              {o.sub !== undefined && o.sub !== null && <span className={cn("num-tabular mt-0.5 truncate text-[12.5px] leading-tight", checked ? "text-ink-2" : "text-muted")}>{o.sub}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}
