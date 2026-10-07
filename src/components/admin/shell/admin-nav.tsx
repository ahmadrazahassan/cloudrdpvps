"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Signal } from "@/components/ledger/primitives";
import { cn } from "@/lib/utils";
import { adminNav, isActive, type BadgeKey } from "./nav-items";

export type NavCounts = Record<BadgeKey, number> & { paymentsStale: boolean };

/**
 * Console navigation. Grouped, bare icons, no boxes: the active row gets the same 2px lavender bar
 * as the dashboard. A count is plain lavender type; payments waiting more than four hours also get a pulsing dot.
 */
export function AdminNav({ isAdmin, counts, onNavigate }: { isAdmin: boolean; counts: NavCounts; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Console" className="space-y-6">
      {adminNav.map((group) => {
        const items = group.items.filter((i) => isAdmin || !i.adminOnly);
        if (items.length === 0) return null;
        return (
          <div key={group.label}>
            <p className="label-caps px-3 pb-1.5">{group.label}</p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(pathname, item);
                const count = item.badge ? counts[item.badge] : 0;
                const stale = item.badge === "payments" && counts.paymentsStale && count > 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex h-9 items-center gap-3 rounded-btn px-3 text-[14px] transition-colors",
                        active
                          ? "bg-black/[0.04] font-semibold text-ink before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-lav-500"
                          : "font-medium text-ink-2 hover:bg-black/[0.03] hover:text-ink",
                      )}
                    >
                      <item.icon size={18} strokeWidth={1.5} aria-hidden className={cn("shrink-0", active ? "text-lav-600" : "text-muted")} />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {count > 0 && (
                        <span className="num-tabular flex items-center gap-1.5 text-[12px] font-semibold text-lav-700">
                          {stale && <Signal tone="warn" pulse />}
                          {count > 99 ? "99+" : count}
                          <span className="sr-only">{stale ? " waiting, some for hours" : " waiting"}</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
