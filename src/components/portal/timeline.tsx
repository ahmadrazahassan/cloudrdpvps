import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LocalTime } from "./local-time";

export interface TimelineItem {
  id: string | number;
  title: ReactNode;
  at?: string | null;
  detail?: ReactNode;
  tone?: "default" | "ok" | "bad" | "pending";
}

/**
 * Vertical hairline stepper. The line and the dots are the only decoration;
 * `pending` items (steps still ahead) are drawn hollow and muted.
 */
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("relative", className)}>
      {items.map((it, i) => {
        const tone = it.tone ?? "default";
        const last = i === items.length - 1;
        return (
          <li key={it.id} className="relative pb-7 pl-7 last:pb-0">
            {!last && <span aria-hidden className="absolute bottom-0 left-[5px] top-3 w-px bg-line-2" />}
            <span
              aria-hidden
              className={cn(
                "absolute left-0 top-[7px] h-[11px] w-[11px] rounded-full border-2",
                tone === "pending" && "border-line-2 bg-bg",
                tone === "default" && "border-lav-600 bg-lav-600",
                tone === "ok" && "border-ok bg-ok",
                tone === "bad" && "border-bad bg-bad",
              )}
            />
            <p className={cn("text-[15px] font-medium", tone === "pending" ? "text-muted" : "text-ink")}>{it.title}</p>
            {it.at && (
              <p className="num-tabular mt-0.5 text-[12px] text-muted">
                <LocalTime value={it.at} />
              </p>
            )}
            {it.detail && <p className="mt-1.5 max-w-[56ch] text-[14px] leading-relaxed text-ink-2">{it.detail}</p>}
          </li>
        );
      })}
    </ol>
  );
}
