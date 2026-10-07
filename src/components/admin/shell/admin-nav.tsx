"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Signal } from "@/components/ledger/primitives";
import { cn } from "@/lib/utils";
import { adminNav, isActive, type BadgeKey } from "./nav-items";

export type NavCounts = Record<BadgeKey, number> & { paymentsStale: boolean };

/**
 * Console navigation. Grouped, with bare icons — never inside a chip: the active row is tinted lavender as a whole
 * and its icon turns lavender. A count is a small solid lavender badge; payments waiting more than four hours also
 * get a pulsing dot. `collapsed` is the 72px icon rail: labels go to the tooltip, groups become hairlines.
 */
export function AdminNav({
  isAdmin,
  counts,
  collapsed = false,
  onNavigate,
}: {
  isAdmin: boolean;
  counts: NavCounts;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Console" className={cn(collapsed ? "space-y-3" : "space-y-6")}>
      {adminNav.map((group, gi) => {
        const items = group.items.filter((i) => isAdmin || !i.adminOnly);
        if (items.length === 0) return null;
        return (
          <div key={group.label}>
            {collapsed ? (
              gi > 0 && <span aria-hidden className="mx-2 mb-3 block h-px bg-line" />
            ) : (
              <p className="label-caps px-3.5 pb-2">{group.label}</p>
            )}
            <ul className="space-y-1">
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
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "relative flex h-10 items-center gap-3 rounded-card px-3.5 text-[14px] transition-colors",
                        collapsed && "justify-center px-0",
                        active ? "bg-lav-50 font-semibold text-lav-800" : "font-medium text-ink-2 hover:bg-bg hover:text-ink",
                      )}
                    >
                      <item.icon size={18} strokeWidth={1.5} aria-hidden className={cn("shrink-0", active ? "text-lav-600" : "text-ink-2")} />
                      <span className={cn("min-w-0 flex-1 truncate", collapsed && "sr-only")}>{item.label}</span>
                      {count > 0 && (
                        <span
                          className={cn(
                            "num-tabular flex items-center gap-1.5 text-[11px] font-semibold leading-none",
                            collapsed && "absolute right-1.5 top-1",
                          )}
                        >
                          {stale && !collapsed && <Signal tone="warn" pulse />}
                          <span className={cn("rounded-badge px-1.5 py-1 text-white", stale ? "bg-warn" : "bg-lav-600", collapsed && "px-1 text-[10px]")}>
                            {count > 99 ? "99+" : count}
                          </span>
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
