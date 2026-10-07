"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
};

/**
 * A true/false choice kept in localStorage (per browser), such as "sidebar collapsed". It is read through
 * useSyncExternalStore so the server renders `false` and the browser switches after hydration without a mismatch;
 * other tabs stay in sync through the `storage` event. Blocked storage just means the default.
 */
export function usePersistedFlag(key: string): [boolean, (value: boolean) => void] {
  const read = useCallback(() => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  }, [key]);
  const value = useSyncExternalStore(subscribe, read, () => false);
  const write = useCallback(
    (next: boolean) => {
      try {
        localStorage.setItem(key, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      listeners.forEach((l) => l());
    },
    [key],
  );
  return [value, write];
}
