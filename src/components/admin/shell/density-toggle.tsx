"use client";

import { Rows3, Rows4 } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

const KEY = "crv.density";
type Density = "compact" | "comfortable";

const listeners = new Set<() => void>();
function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}
function read(): Density {
  try {
    return localStorage.getItem(KEY) === "comfortable" ? "comfortable" : "compact";
  } catch {
    return "compact"; // storage can be blocked
  }
}
function write(value: Density) {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

/** Compact (44px rows) or comfortable (56px) tables. Remembered per browser; applied as `html[data-density]`. */
export function DensityToggle() {
  const density = useSyncExternalStore(subscribe, read, () => "compact" as Density);

  useEffect(() => {
    if (density === "comfortable") document.documentElement.dataset.density = "comfortable";
    else delete document.documentElement.dataset.density;
  }, [density]);

  const comfortable = density === "comfortable";
  const Icon = comfortable ? Rows3 : Rows4;
  return (
    <button
      type="button"
      onClick={() => write(comfortable ? "compact" : "comfortable")}
      aria-pressed={comfortable}
      aria-label="Comfortable row spacing"
      title={comfortable ? "Switch to compact rows" : "Switch to comfortable rows"}
      className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-card text-ink-2 transition-colors hover:bg-black/[0.05] hover:text-ink sm:inline-flex"
    >
      <Icon size={18} strokeWidth={1.5} aria-hidden />
    </button>
  );
}
