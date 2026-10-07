"use client";

import { Menu } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

// The Radix dialog is only downloaded when someone actually reaches for the menu.
const MobileSheet = dynamic(() => import("./mobile-sheet"), { ssr: false });
const preload = () => void import("./mobile-sheet");

export function MobileNav({
  rdpFrom,
  vpsFrom,
}: {
  rdpFrom: number | null;
  vpsFrom: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onPointerEnter={preload}
        onFocus={preload}
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
        className="inline-flex h-10 w-10 items-center justify-center rounded-btn border border-line-2 text-ink transition-colors hover:bg-black/[0.04] xl:hidden"
      >
        <Menu size={22} strokeWidth={1.5} aria-hidden />
      </button>
      {mounted && (
        <MobileSheet
          open={open}
          onOpenChange={setOpen}
          rdpFrom={rdpFrom}
          vpsFrom={vpsFrom}
        />
      )}
    </>
  );
}
