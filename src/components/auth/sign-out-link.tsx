"use client";

import { logout } from "@/app/(auth)/actions";

/** A text link that signs the current session out and returns to the home page (or to `next`, a path on this site). */
export function SignOutLink({ label = "Sign out", next }: { label?: string; next?: string }) {
  return (
    <button type="button" onClick={() => void logout({ next })} className="text-link">
      {label}
    </button>
  );
}
