"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { applyAuthHint } from "@/lib/auth-hint";

/**
 * Keeps `<html data-auth>` right after the first paint (an inline script sets it before that). Needed because moving
 * between pages by link doesn't reload the page: someone who signs in, then clicks the logo, must still see "Dashboard".
 */
export function AuthHintSync() {
  const pathname = usePathname();
  useEffect(() => {
    applyAuthHint(document);
    const refresh = () => applyAuthHint(document);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [pathname]);
  return null;
}
