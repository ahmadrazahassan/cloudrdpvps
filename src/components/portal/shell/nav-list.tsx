"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActive, portalNav } from "./nav-items";

/**
 * The portal's primary navigation. Bare icons, no boxes: the active row gets a
 * 2px lavender bar on its left edge and a faint row highlight — nothing around the icon.
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
      <ul className="space-y-0.5">
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
                  "relative flex h-11 items-center gap-3 rounded-btn px-3 text-[15px] transition-colors",
                  collapsed && "justify-center px-0",
                  active
                    ? "bg-black/[0.04] font-semibold text-ink before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-lav-500"
                    : "font-medium text-ink-2 hover:bg-black/[0.03] hover:text-ink",
                )}
              >
                <item.icon
                  size={20}
                  strokeWidth={1.5}
                  aria-hidden
                  className={cn("shrink-0", active ? "text-lav-600" : "text-muted")}
                />
                <span className={cn(collapsed && "sr-only")}>{item.label}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      "num-tabular ml-auto text-[12px] font-semibold text-lav-700",
                      collapsed && "absolute right-2 top-1.5 ml-0 text-[10px]",
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
