"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Icon-only copy control. The icon swaps to a check for 1.5 s and a polite live
 * region announces "Copied" to screen readers. No box around the icon.
 */
export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  /** What is being copied, for the accessible name: "Copy IP address". */
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (insecure origin, permissions). Selecting the text still works.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-btn text-muted transition-colors hover:bg-black/[0.05] hover:text-ink",
        className,
      )}
    >
      {copied ? (
        <Check size={16} strokeWidth={1.75} aria-hidden className="text-ok" />
      ) : (
        <Copy size={16} strokeWidth={1.5} aria-hidden />
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}
