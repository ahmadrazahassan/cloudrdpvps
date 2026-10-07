import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Money is stored as integer cents; always render USD. */
export function formatUsd(cents: number, opts?: { cents?: boolean }) {
  const dollars = cents / 100;
  const showCents = opts?.cents ?? !Number.isInteger(dollars);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(dollars);
}

/** 100 -> "100 Mbps", 1000 -> "1 Gbps" */
export function formatPort(mbps: number) {
  return mbps >= 1000 ? `${mbps / 1000} Gbps` : `${mbps} Mbps`;
}
