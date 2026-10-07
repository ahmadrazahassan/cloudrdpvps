"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PaletteButton } from "@/components/ledger/command-palette";
import { AdminNav, type NavCounts } from "./admin-nav";
import { AdminBrand } from "./admin-sidebar";
import { AdminUserMenu, type AdminMenuUser } from "./admin-user-menu";
import { DensityToggle } from "./density-toggle";
import { crumbLabels } from "./nav-items";

/** Admin / Orders / Details, built from the URL. Anything that isn't a known word (an id) reads "Details". */
function Crumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const trail = segments.map((seg, i) => ({ label: crumbLabels[seg] ?? "Details", href: "/" + segments.slice(0, i + 1).join("/") }));
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
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

/** 72px bar on the page itself (no band, no rule): menu (phones), breadcrumbs, search / command palette, density. */
export function AdminTopbar({ user, counts, isAdmin }: { user: AdminMenuUser; counts: NavCounts; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-[72px] items-center gap-3 bg-bg/85 px-4 backdrop-blur-md sm:px-6 lg:px-8 print:hidden">
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger aria-label="Open menu" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-card text-ink hover:bg-black/[0.05] lg:hidden">
          <Menu size={22} strokeWidth={1.5} aria-hidden />
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-ink/30 data-[state=open]:animate-[fade-in_0.2s_ease-out]" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-[70] flex w-[86%] max-w-[300px] flex-col rounded-r-panel bg-surface p-5 shadow-2 data-[state=open]:animate-[sheet-in_0.25s_ease-out]">
            <Dialog.Title className="sr-only">Menu</Dialog.Title>
            <Dialog.Description className="sr-only">Console navigation</Dialog.Description>
            <div className="flex items-center justify-between">
              <AdminBrand onNavigate={() => setOpen(false)} />
              <Dialog.Close className="inline-flex h-10 w-10 items-center justify-center rounded-card hover:bg-black/[0.05]" aria-label="Close menu">
                <X size={22} strokeWidth={1.5} aria-hidden />
              </Dialog.Close>
            </div>
            <div className="mt-6 flex-1 overflow-y-auto">
              <AdminNav isAdmin={isAdmin} counts={counts} onNavigate={() => setOpen(false)} />
            </div>
            <div className="mt-4 border-t border-line pt-4">
              <AdminUserMenu user={user} />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Crumbs />
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <div className="w-full min-w-0 max-w-[340px]">
          <PaletteButton placeholder="Search or jump to…" className="h-11 rounded-card border-black/[0.06] bg-surface shadow-1 hover:border-line-2" />
        </div>
        <DensityToggle />
      </div>
    </header>
  );
}
