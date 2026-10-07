import Link from "next/link";
import { LogoArtwork } from "@/components/brand/logo";
import { site } from "@/content/site";
import { AdminNav, type NavCounts } from "./admin-nav";
import { AdminUserMenu, type AdminMenuUser } from "./admin-user-menu";

/** The small hairline tag beside the wordmark that says this is the console, not the customer dashboard. */
export function AdminTag() {
  return (
    <span className="rounded-badge border border-lav-300 px-1.5 py-[3px] text-[10px] font-semibold uppercase leading-none tracking-[0.1em] text-lav-800">
      Admin
    </span>
  );
}

export function AdminBrand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link href="/admin" onClick={onNavigate} aria-label={`${site.name} admin home`} className="inline-flex items-center gap-2.5 px-1">
      <LogoArtwork className="h-auto w-[156px]" />
      <AdminTag />
    </Link>
  );
}

/** Desktop sidebar: 248px, hairline on the right, no fill. */
export function AdminSidebar({ user, counts, isAdmin }: { user: AdminMenuUser; counts: NavCounts; isAdmin: boolean }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-line px-4 py-5 lg:flex print:hidden">
      <AdminBrand />
      <div className="mt-6 flex-1 overflow-y-auto pr-1">
        <AdminNav isAdmin={isAdmin} counts={counts} />
      </div>
      <div className="mt-4 border-t border-line pt-4">
        <AdminUserMenu user={user} />
      </div>
    </aside>
  );
}
