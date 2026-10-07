"use client";

import { ArrowUp } from "lucide-react";

export function BackToTop() {
  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => {
        const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" });
      }}
      className="grid h-11 w-11 place-items-center rounded-[10px] border border-white/15 text-white/80 transition-colors hover:border-white/35 hover:text-white"
    >
      <ArrowUp size={18} strokeWidth={1.5} aria-hidden />
    </button>
  );
}
