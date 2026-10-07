"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActive, portalNav } from "./nav-items";

/**
 * The portal's primary navigation. Bare icons, never inside a chip: the active row is tinted lavender
 * as a whole (icon and label together) and its icon turns lavender — nothing is drawn behind the icon itself.
 */
export function NavList({
  unread = 0,
  collapsed = false,
  onNavigate,
}: {
  unread?: number;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard">
      <ul className="space-y-1">
        {portalNav.map((item) => {
          const active = isActive(pathname, item);
          const count = item.badge === "unread" ? unread : 0;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "relative flex h-11 items-center gap-3 rounded-card px-3.5 text-[15px] transition-colors",
                  collapsed && "justify-center px-0",
                  active
                    ? "bg-lav-50 font-semibold text-lav-800"
                    : "font-medium text-ink-2 hover:bg-bg hover:text-ink",
                )}
              >
                <item.icon
                  size={20}
                  strokeWidth={1.5}
                  aria-hidden
                  className={cn("shrink-0", active ? "text-lav-600" : "text-ink-2")}
                />
                <span className={cn(collapsed && "sr-only")}>{item.label}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      "num-tabular ml-auto rounded-badge bg-lav-600 px-1.5 py-1 text-[11px] font-semibold leading-none text-white",
                      collapsed && "absolute right-1.5 top-1 ml-0 px-1 text-[10px]",
                    )}
                  >
                    {count > 99 ? "99+" : count}
                    <span className="sr-only"> unread</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
