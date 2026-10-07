import { RulerMeter } from "@/components/ledger/ruler-meter";

/**
 * How much of the 30-day term is left, drawn as the product's ruler (one tick per day) with the
 * exact date underneath. Kept as a thin wrapper so the portal's call sites didn't change.
 */
export function ExpiryMeter({
  expiresAt,
  daysLeft,
  termDays = 30,
  className,
}: {
  expiresAt: string;
  daysLeft: number;
  termDays?: number;
  className?: string;
}) {
  return <RulerMeter expiresAt={expiresAt} daysLeft={daysLeft} termDays={termDays} className={className} />;
}
