"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Bell, Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { openPalette, PaletteButton } from "@/components/ledger/command-palette";
import { ButtonLink } from "@/components/ui/button";
import { NavList } from "./nav-list";
import { crumbLabels } from "./nav-items";
import { UserMenu, type MenuUser } from "./user-menu";

/** Home / Orders / Details, built from the URL. Anything that isn't a known word (an id) reads "Details". */
function Crumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean); // ["dashboard", "orders", "<id>", "pay"]
  const trail = segments.map((seg, i) => ({
    label: crumbLabels[seg] ?? "Details",
    href: "/" + segments.slice(0, i + 1).join("/"),
  }));
  // The first crumb ("Overview") is the dashboard itself.
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-2 overflow-hidden whitespace-nowrap text-[13px] text-muted">
        {trail.map((c, i) => {
          const last = i === trail.length - 1;
          return (
            <li key={c.href} className="flex items-center gap-2">
              {last ? (
                <span aria-current="page" className="font-medium text-ink">
                  {c.label}
                </span>
              ) : (
                <Link href={c.href} className="transition-colors hover:text-ink">
                  {c.label}
                </Link>
              )}
              {!last && (
                <span aria-hidden className="text-line-2">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** 72px top bar on the page itself (no band, no rule): menu button (phones), breadcrumbs, search and the bell. */
export function PortalTopbar({ user, unread }: { user: MenuUser; unread: number }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-[72px] items-center justify-between gap-4 bg-bg/85 px-4 backdrop-blur-md sm:px-6 lg:px-8 print:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger
            aria-label="Open menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-card text-ink hover:bg-black/[0.05] lg:hidden"
          >
            <Menu size={22} strokeWidth={1.5} aria-hidden />
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-[60] bg-ink/30 data-[state=open]:animate-[fade-in_0.2s_ease-out]" />
            <Dialog.Content className="fixed inset-y-0 left-0 z-[70] flex w-[86%] max-w-[300px] flex-col rounded-r-panel bg-surface p-5 shadow-2 data-[state=open]:animate-[sheet-in_0.25s_ease-out]">
              <Dialog.Title className="sr-only">Menu</Dialog.Title>
              <Dialog.Description className="sr-only">Dashboard navigation</Dialog.Description>
              <div className="flex items-center justify-between">
                <Logo href="/dashboard" />
                <Dialog.Close
                  className="inline-flex h-10 w-10 items-center justify-center rounded-card hover:bg-black/[0.05]"
                  aria-label="Close menu"
                >
                  <X size={22} strokeWidth={1.5} aria-hidden />
                </Dialog.Close>
              </div>
              <ButtonLink href="/order/new" className="mt-6 w-full" onClick={() => setOpen(false)}>
                New order
              </ButtonLink>
              <div className="mt-6 flex-1 overflow-y-auto">
                <NavList unread={unread} onNavigate={() => setOpen(false)} />
              </div>
              <div className="mt-4 border-t border-line pt-4">
                <UserMenu user={user} />
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <Crumbs />
      </div>

      <div className="ml-auto hidden w-full max-w-[340px] md:block">
        <PaletteButton
          placeholder="Search or jump to…"
          className="h-11 rounded-card border-black/[0.06] bg-surface shadow-1 hover:border-line-2"
        />
      </div>
      <button
        type="button"
        onClick={openPalette}
        aria-label="Search"
        className="ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-card text-ink hover:bg-black/[0.05] md:hidden"
      >
        <Search size={20} strokeWidth={1.5} aria-hidden />
      </button>
      <Link
        href="/dashboard/notifications"
        className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-card text-ink hover:bg-black/[0.05]"
      >
        <Bell size={20} strokeWidth={1.5} aria-hidden />
        {unread > 0 && <span aria-hidden className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full border-2 border-bg bg-lav-600" />}
        <span className="sr-only">Notifications{unread > 0 ? `, ${unread} unread` : ""}</span>
      </Link>
    </header>
  );
}
