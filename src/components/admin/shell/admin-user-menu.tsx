"use client";

import { ChevronUp, LayoutDashboard, LogOut } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils";

export interface AdminMenuUser {
  name: string;
  email: string;
  initials: string;
  role: "support" | "admin";
}

/** Account block at the foot of the console sidebar: who you are, your role, a way back to the customer dashboard, sign out. */
export function AdminUserMenu({ user, collapsed = false }: { user: AdminMenuUser; collapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[14px] font-medium text-ink hover:bg-bg";

  return (
    <div ref={root} className="relative">
      {open && (
        <div id="admin-user-menu" role="menu" className="absolute bottom-full left-0 z-30 mb-2 w-[232px] rounded-card border border-black/[0.06] bg-surface p-1.5 shadow-2">
          <Link href="/dashboard" role="menuitem" onClick={() => setOpen(false)} className={item}>
            <LayoutDashboard size={18} strokeWidth={1.5} aria-hidden className="text-muted" />
            Customer dashboard
          </Link>
          <div role="separator" className="mx-1 my-1.5 h-px bg-line" />
          <button type="button" role="menuitem" onClick={() => void logout({})} className={item}>
            <LogOut size={18} strokeWidth={1.5} aria-hidden className="text-muted" />
            Sign out
          </button>
        </div>
      )}
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls="admin-user-menu"
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className={cn("flex w-full items-center gap-3 rounded-card px-2.5 py-2 text-left transition-colors hover:bg-bg", collapsed && "justify-center")}
      >
        <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lav-100 text-[12px] font-semibold text-lav-800">
          {user.initials}
        </span>
        <span className={cn("min-w-0 flex-1", collapsed && "sr-only")}>
          <span className="block truncate text-[14px] font-semibold text-ink">{user.name}</span>
          <span className="block truncate text-[12px] capitalize text-muted">{user.role}</span>
        </span>
        {!collapsed && <ChevronUp size={16} strokeWidth={1.5} aria-hidden className={cn("text-muted transition-transform", !open && "rotate-180")} />}
      </button>
    </div>
  );
}
