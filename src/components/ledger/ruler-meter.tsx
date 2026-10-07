import { formatDate, plural } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The 30-day term drawn as a ruler: one tick per day. Days already used are short and grey, the
 * current day is a tall ink tick, days still to come stand in lavender (amber at 7 days or fewer, red
 * once expired), and every seventh tick is a little taller — a week mark. It is the one signature
 * graphic of the product: flat, exact, and readable at a glance.
 */
export function RulerMeter({
  expiresAt,
  daysLeft,
  termDays = 30,
  caption = true,
  className,
}: {
  expiresAt: string;
  daysLeft: number;
  termDays?: number;
  /** The "Expires 12 Nov 2026 · 21 days left" line under the ticks. */
  caption?: boolean;
  className?: string;
}) {
  const expired = daysLeft <= 0;
  const remaining = Math.max(0, Math.min(termDays, daysLeft));
  const used = termDays - remaining; // ticks already gone
  const ahead = expired ? "bg-bad" : daysLeft <= 7 ? "bg-warn" : "bg-lav-500";

  return (
    <div className={className}>
      <div
        role="meter"
        aria-label="Time left in this term"
        aria-valuemin={0}
        aria-valuemax={termDays}
        aria-valuenow={remaining}
        aria-valuetext={expired ? "Expired" : plural(daysLeft, "day") + " left"}
        className="flex h-6 items-end justify-between"
      >
        {Array.from({ length: termDays }, (_, i) => {
          const week = i % 7 === 0;
          const now = !expired && i === used;
          const past = expired || i < used;
          return (
            <span
              key={i}
              aria-hidden
              className={cn(
                "w-[2px] flex-none rounded-[1px]",
                now ? "h-6 bg-ink" : week ? "h-4" : "h-2.5",
                !now && (past ? (expired ? "bg-bad/60" : "bg-line-2") : ahead),
              )}
            />
          );
        })}
      </div>
      {caption && (
        <p className="mt-2.5 text-[13px] text-muted">
          {expired ? "Expired" : "Expires"} {formatDate(expiresAt)}
          {!expired && <> · {plural(daysLeft, "day")} left</>}
        </p>
      )}
    </div>
  );
}
