"use client";

import { PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NavList } from "./nav-list";
import { UserMenu, type MenuUser } from "./user-menu";

const STORAGE_KEY = "crv.sidebar.collapsed";

/**
 * The collapsed/expanded choice lives in localStorage (per browser). It is read through
 * useSyncExternalStore so the server renders "expanded" and the browser switches after hydration
 * without a mismatch; other tabs stay in sync through the `storage` event.
 */
const listeners = new Set<() => void>();
function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}
function readCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false; // storage can be blocked; expanded is a fine default
  }
}
function writeCollapsed(value: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

/**
 * Desktop sidebar: 264px, collapsible to a 72px icon rail. Separated from the page by a hairline, no fill.
 */
export function PortalSidebar({ user, unread }: { user: MenuUser; unread: number }) {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line py-5 transition-[width] duration-200 lg:flex print:hidden",
        collapsed ? "w-[72px] px-3" : "w-[264px] px-4",
      )}
    >
      <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between px-1")}>
        {collapsed ? (
          <Link href="/dashboard" aria-label="Dashboard home">
            <LogoMark className="h-7 w-7" />
          </Link>
        ) : (
          <Logo href="/dashboard" />
        )}
      </div>

      <div className="mt-7">
        {collapsed ? (
          <ButtonLink href="/order/new" size="sm" className="w-full px-0" aria-label="New order">
            <Plus size={18} strokeWidth={2} aria-hidden />
          </ButtonLink>
        ) : (
          <ButtonLink href="/order/new" className="w-full">
            New order
          </ButtonLink>
        )}
      </div>

      <div className="mt-6 flex-1 overflow-y-auto">
        <NavList unread={unread} collapsed={collapsed} />
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <UserMenu user={user} collapsed={collapsed} />
        <button
          type="button"
          onClick={() => writeCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          className={cn(
            "mt-2 flex h-9 w-full items-center gap-3 rounded-btn px-3 text-[13px] font-medium text-muted transition-colors hover:bg-black/[0.04] hover:text-ink",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} strokeWidth={1.5} aria-hidden />
          ) : (
            <>
              <PanelLeftClose size={18} strokeWidth={1.5} aria-hidden />
              Collapse
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
