"use client";

import { ArrowUpRight, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const COPIES = 6;
const headline = "font-display text-[clamp(34px,4.4vw,60px)] leading-none tracking-[-0.035em] text-ink";

/** One repeat of the line. Every copy after the first is hidden from assistive tech and from the Tab key. */
function Copy({ extra }: { extra?: boolean }) {
  return (
    <div
      className="flex shrink-0 items-center gap-8 pr-8 md:gap-12 md:pr-12"
      aria-hidden={extra || undefined}
      inert={extra || undefined}
    >
      <p className={`${headline} whitespace-nowrap font-normal`}>Ready to get online today?</p>
      {/* A dark icon square joined to a dark label, 2px apart */}
      <Link href="/pricing" tabIndex={extra ? -1 : undefined} className="group inline-flex shrink-0 gap-[2px]">
        <span className="grid h-11 w-11 place-items-center rounded-[10px] bg-ink text-white transition-colors group-hover:bg-lav-900">
          <ArrowUpRight size={18} strokeWidth={1.75} aria-hidden />
        </span>
        <span className="inline-flex h-11 items-center rounded-[10px] bg-ink px-5 text-[15px] font-medium text-white transition-colors group-hover:bg-lav-900">
          View plans
        </span>
      </Link>
      <span aria-hidden className={`${headline} font-normal opacity-50`}>
        /
      </span>
    </div>
  );
}

/**
 * The lavender call-to-action band above the footer: one line that scrolls sideways for ever.
 * Moving content has to be stoppable (WCAG 2.2.2), so it pauses on hover and keyboard focus, has a
 * pause button, and stands still for visitors who asked for reduced motion.
 */
export function FooterMarquee() {
  const [paused, setPaused] = useState(false);
  return (
    <div className="footer-marquee relative overflow-hidden py-9 md:py-12" data-paused={paused}>
      <div className="footer-marquee-track">
        {Array.from({ length: COPIES }, (_, i) => (
          <Copy key={i} extra={i > 0} />
        ))}
      </div>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        aria-label={paused ? "Play the scrolling banner" : "Pause the scrolling banner"}
        className="footer-marquee-pause absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-[10px] bg-lav-300 text-ink transition-colors hover:bg-lav-200"
      >
        {paused ? <Play size={15} strokeWidth={1.75} aria-hidden /> : <Pause size={15} strokeWidth={1.75} aria-hidden />}
      </button>
    </div>
  );
}
