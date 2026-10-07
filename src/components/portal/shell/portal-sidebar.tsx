"use client";

import { PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import Link from "next/link";
import { Logo, LogoMark } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { usePersistedFlag } from "@/lib/use-persisted-flag";
import { cn } from "@/lib/utils";
import { NavList } from "./nav-list";
import { UserMenu, type MenuUser } from "./user-menu";

const STORAGE_KEY = "crv.sidebar.collapsed";

/**
 * Desktop sidebar: a white card floating on the page (264px, collapsible to a 72px icon rail). The outer
 * wrapper only reserves the column and its 12px gutter; the card inside is what scrolls with the viewport.
 */
export function PortalSidebar({ user, unread }: { user: MenuUser; unread: number }) {
  const [collapsed, setCollapsed] = usePersistedFlag(STORAGE_KEY);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 p-3 pr-0 transition-[width] duration-200 lg:block print:hidden",
        collapsed ? "w-[84px]" : "w-[276px]",
      )}
    >
      <div
        className={cn(
          "flex h-full flex-col rounded-panel border border-black/[0.06] bg-surface py-5 shadow-1",
          collapsed ? "px-3" : "px-4",
        )}
      >
        <div className={cn("flex h-9 items-center", collapsed ? "justify-center" : "px-1.5")}>
          {collapsed ? (
            <Link href="/dashboard" aria-label="Dashboard home">
              <LogoMark className="h-7 w-7" />
            </Link>
          ) : (
            <Logo href="/dashboard" />
          )}
        </div>

        <div className="mt-6">
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
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            className={cn(
              "mt-1 flex h-9 w-full items-center gap-3 rounded-card px-3.5 text-[13px] font-medium text-muted transition-colors hover:bg-bg hover:text-ink",
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
      </div>
    </aside>
  );
}
