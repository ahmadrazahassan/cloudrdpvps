import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

/**
 * The header's account buttons. Both versions are in the static HTML; the stylesheet shows one of them from
 * `<html data-auth>` (set in the browser from the session cookie — see lib/auth-hint.ts), so there is no flash and
 * the pages stay static. Signed out: Log in + Get started. Signed in: Dashboard.
 */
export function HeaderAuthActions() {
  return (
    <>
      <ButtonLink data-auth-show="out" href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
        Log in
      </ButtonLink>
      <ButtonLink data-auth-show="out" href="/#pricing" size="sm" className="hidden sm:inline-flex">
        Get started
        <ArrowRight size={14} strokeWidth={2} aria-hidden />
      </ButtonLink>
      {/* Shown on phones too (text only, and hidden below 360px where the menu has it) so a signed-in visitor can always get back in. */}
      <ButtonLink data-auth-show="in" href="/dashboard" size="sm" className="max-[359px]:hidden">
        Dashboard
        <ArrowRight size={14} strokeWidth={2} aria-hidden className="hidden sm:block" />
      </ButtonLink>
    </>
  );
}
