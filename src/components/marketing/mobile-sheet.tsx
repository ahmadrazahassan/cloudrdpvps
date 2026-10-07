"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { nav } from "@/content/site";
import { cn, formatUsd } from "@/lib/utils";

/** The slide-over menu. Loaded lazily by <MobileNav> on first interaction. */
export default function MobileSheet({
  open,
  onOpenChange,
  rdpFrom,
  vpsFrom,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rdpFrom: number | null;
  vpsFrom: number | null;
}) {
  const pathname = usePathname();
  const close = () => onOpenChange(false);
  const current = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const row = (href: string) =>
    cn(
      "flex items-center justify-between border-b border-line py-4 text-[17px] font-medium",
      current(href) ? "text-lav-700" : "text-ink",
    );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-ink/30 data-[state=open]:animate-[fade-in_0.2s_ease-out]" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-[70] flex w-[90%] max-w-sm flex-col border-l border-line bg-bg p-5 data-[state=open]:animate-[sheet-in_0.25s_ease-out]">
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          <Dialog.Description className="sr-only">Site navigation</Dialog.Description>
          <div className="flex items-center justify-between">
            <Logo href={null} />
            <Dialog.Close
              className="inline-flex h-10 w-10 items-center justify-center rounded-btn hover:bg-black/[0.05]"
              aria-label="Close menu"
            >
              <X size={22} strokeWidth={1.5} aria-hidden />
            </Dialog.Close>
          </div>

          <nav className="mt-6 flex-1 overflow-y-auto" aria-label="Mobile">
            <p className="label-caps pb-2">Products</p>
            <Link href="/rdp" onClick={close} aria-current={current("/rdp") ? "page" : undefined} className={row("/rdp")}>
              <span>
                Windows RDP
                {rdpFrom !== null && (
                  <span className="label-caps ml-3 normal-case tracking-normal text-lav-700">
                    from {formatUsd(rdpFrom)}
                  </span>
                )}
              </span>
              <ArrowRight size={18} strokeWidth={1.5} aria-hidden />
            </Link>
            <Link href="/vps" onClick={close} aria-current={current("/vps") ? "page" : undefined} className={row("/vps")}>
              <span>
                Windows VPS
                {vpsFrom !== null && (
                  <span className="label-caps ml-3 normal-case tracking-normal text-lav-700">
                    from {formatUsd(vpsFrom)}
                  </span>
                )}
              </span>
              <ArrowRight size={18} strokeWidth={1.5} aria-hidden />
            </Link>
            <p className="label-caps pb-2 pt-6">Explore</p>
            {nav.main.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                aria-current={current(item.href) ? "page" : undefined}
                className={row(item.href)}
              >
                {item.label}
                <ArrowRight size={18} strokeWidth={1.5} aria-hidden />
              </Link>
            ))}
          </nav>

          {/* Signed out / signed in: both are rendered, the stylesheet shows one (see lib/auth-hint.ts). */}
          <div data-auth-show="out" className="mt-4 grid gap-3 border-t border-line pt-5">
            <ButtonLink href="/#pricing" size="lg" onClick={close}>
              Get started
            </ButtonLink>
            <ButtonLink href="/login" variant="secondary" size="lg" onClick={close}>
              Log in
            </ButtonLink>
          </div>
          <div data-auth-show="in" className="mt-4 grid gap-3 border-t border-line pt-5">
            <ButtonLink href="/dashboard" size="lg" onClick={close}>
              Dashboard
            </ButtonLink>
            <ButtonLink href="/order/new" variant="secondary" size="lg" onClick={close}>
              Order a server
            </ButtonLink>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
