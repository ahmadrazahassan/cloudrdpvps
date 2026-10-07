import type { Metadata } from "next";
import { CommandPalette, type PaletteItem } from "@/components/ledger/command-palette";
import { AdminSidebar } from "@/components/admin/shell/admin-sidebar";
import { AdminTopbar } from "@/components/admin/shell/admin-topbar";
import { LiveSync } from "@/components/admin/shell/live-sync";
import { adminNav } from "@/components/admin/shell/nav-items";
import { QueueRibbon } from "@/components/admin/shell/queue-ribbon";
import { adminSearch } from "@/lib/admin/actions/search";
import { requireConsole } from "@/lib/admin/guard";
import { getActionQueue } from "@/lib/admin/queries";
import { isAdmin as isAdminUser } from "@/lib/auth/session";
import { now } from "@/lib/clock";

export async function generateMetadata(): Promise<Metadata> {
  const q = await getActionQueue();
  const n = q.paymentsToReview + q.ordersToAllocate + q.ticketsAwaitingStaff + q.unreadInbox;
  return {
    title: { default: n > 0 ? `(${n}) Admin` : "Admin", template: n > 0 ? `(${n}) %s · Admin` : "%s · Admin" },
    robots: { index: false, follow: false },
  };
}

const initials = (name: string, email: string) =>
  (name.trim() || email)
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "A";

/**
 * The console shell. Pages guard themselves too (layouts and pages render in parallel, so this check
 * alone would not protect their data) — see `requireConsole` / `requireAdminConsole`.
 */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await requireConsole();
  const admin = isAdminUser(user);
  const queue = await getActionQueue();
  const nowMs = now();

  const hours = queue.oldestPendingPaymentAt ? (nowMs - Date.parse(queue.oldestPendingPaymentAt)) / 3_600_000 : 0;
  const counts = {
    payments: queue.paymentsToReview,
    orders: queue.ordersToAllocate,
    tickets: queue.ticketsAwaitingStaff,
    inbox: queue.unreadInbox,
    paymentsStale: hours > 4,
  };

  const name = user.profile.full_name.trim() || user.email.split("@")[0]!;
  const menuUser = { name, email: user.email, initials: initials(user.profile.full_name, user.email), role: user.profile.role as "support" | "admin" };

  const pages: PaletteItem[] = adminNav.flatMap((g) =>
    g.items
      .filter((i) => admin || !i.adminOnly)
      .map((i) => ({ id: `nav-${i.href}`, group: "Go to", label: i.label, href: i.href, goto: i.goto, keywords: g.label })),
  );

  return (
    <div className="min-h-screen lg:flex">
      <a
        href="#main"
        className="sr-only z-[80] rounded-btn bg-ink px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <LiveSync />
      <CommandPalette items={pages} search={adminSearch} placeholder="Jump to a page, or search orders, customers, IPs, tickets…" />
      <AdminSidebar user={menuUser} counts={counts} isAdmin={admin} />
      <div className="min-w-0 flex-1">
        <AdminTopbar user={menuUser} counts={counts} isAdmin={admin} />
        <QueueRibbon queue={queue} nowMs={nowMs} isAdmin={admin} />
        <main id="main" className="px-4 pb-24 pt-8 sm:px-8">
          <div className="mx-auto max-w-[1360px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
