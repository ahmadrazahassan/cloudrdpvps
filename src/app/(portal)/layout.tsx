import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CommandPalette, type PaletteItem } from "@/components/ledger/command-palette";
import { NotificationsLive } from "@/components/portal/notification-parts";
import { portalNav } from "@/components/portal/shell/nav-items";
import { PortalSidebar } from "@/components/portal/shell/portal-sidebar";
import { PortalTopbar } from "@/components/portal/shell/portal-topbar";
import { portalSearch } from "./dashboard/search-action";
import { requireUser, isStaff } from "@/lib/auth/session";
import { getUnreadCount } from "@/lib/portal/queries";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Dashboard" },
  robots: { index: false, follow: false },
};

const initials = (name: string, email: string) =>
  (name.trim() || email)
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "U";

/**
 * Signed-in shell. The proxy has already bounced signed-out visitors; this re-checks
 * (a proxy is a convenience, never the only gate) and also requires a verified email.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/dashboard");
  if (!user.emailVerified) redirect("/verify-email");

  const unread = await getUnreadCount();
  const name = user.profile.full_name.trim() || user.email.split("@")[0]!;
  const menuUser = { name, email: user.email, initials: initials(user.profile.full_name, user.email), isStaff: isStaff(user) };
  const suspended = user.profile.status === "suspended";

  const paletteItems: PaletteItem[] = [
    ...portalNav.map((i) => ({ id: `nav-${i.href}`, group: "Go to", label: i.label, href: i.href, goto: i.goto })),
    { id: "act-order", group: "Actions", label: "Order a new server", href: "/order/new", keywords: "buy purchase new" },
    { id: "act-ticket", group: "Actions", label: "Open a support ticket", href: "/dashboard/tickets/new", keywords: "help contact" },
    ...(isStaff(user) ? [{ id: "act-admin", group: "Actions", label: "Open the admin console", href: "/admin", keywords: "staff" }] : []),
  ];

  return (
    <div className="min-h-screen lg:flex">
      <a
        href="#main"
        className="sr-only z-[80] rounded-btn bg-ink px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <NotificationsLive userId={user.id} />
      <CommandPalette items={paletteItems} search={portalSearch} placeholder="Jump to a page, or find a server, order or ticket…" />
      <PortalSidebar user={menuUser} unread={unread} />
      <div className="min-w-0 flex-1">
        <PortalTopbar user={menuUser} unread={unread} />
        {suspended && (
          <div className="px-4 sm:px-6 lg:px-8">
            <div role="alert" className="mx-auto max-w-[1280px] rounded-card bg-warn-bg px-5 py-3.5 text-[14px] leading-relaxed text-warn">
              Your account is suspended
              {user.profile.suspended_reason ? `: ${user.profile.suspended_reason}` : "."} You can still read your
              records and open support tickets, but new orders are paused.{" "}
              <Link href="/dashboard/tickets/new" className="font-semibold underline underline-offset-4">
                Contact support
              </Link>
            </div>
          </div>
        )}
        <main id="main" className="px-4 pb-20 pt-3 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1280px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
