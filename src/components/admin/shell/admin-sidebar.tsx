"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { LogoArtwork, LogoMark } from "@/components/brand/logo";
import { site } from "@/content/site";
import { usePersistedFlag } from "@/lib/use-persisted-flag";
import { cn } from "@/lib/utils";
import { AdminNav, type NavCounts } from "./admin-nav";
import { AdminUserMenu, type AdminMenuUser } from "./admin-user-menu";

const STORAGE_KEY = "crv.admin.sidebar.collapsed";

/** The small tag beside the wordmark that says this is the console, not the customer dashboard. */
export function AdminTag() {
  return (
    <span className="rounded-badge bg-lav-100 px-2 py-[5px] text-[10px] font-semibold uppercase leading-none tracking-[0.1em] text-lav-800">
      Admin
    </span>
  );
}

export function AdminBrand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link href="/admin" onClick={onNavigate} aria-label={`${site.name} admin home`} className="inline-flex items-center gap-2.5 px-1.5">
      <LogoArtwork className="h-auto w-[148px]" />
      <AdminTag />
    </Link>
  );
}

/**
 * Desktop sidebar: a white card floating on the page (264px, collapsible to a 72px icon rail) — the same as the
 * customer dashboard's. The outer wrapper only reserves the column and its gutter.
 */
export function AdminSidebar({ user, counts, isAdmin }: { user: AdminMenuUser; counts: NavCounts; isAdmin: boolean }) {
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
        <div className={cn("flex h-9 items-center", collapsed && "justify-center")}>
          {collapsed ? (
            <Link href="/admin" aria-label={`${site.name} admin home`}>
              <LogoMark className="h-7 w-7" />
            </Link>
          ) : (
            <AdminBrand />
          )}
        </div>

        <div className="mt-6 flex-1 overflow-y-auto pr-1">
          <AdminNav isAdmin={isAdmin} counts={counts} collapsed={collapsed} />
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <AdminUserMenu user={user} collapsed={collapsed} />
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
