import { Bell, LayoutDashboard, LifeBuoy, ReceiptText, Server, Settings, Wallet, type LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Match nested routes (/dashboard/orders/123) as well as the exact path. */
  exact?: boolean;
  badge?: "unread";
  /** `g` then this letter jumps here (see the command palette). */
  goto?: string;
}

export const portalNav: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard, exact: true, goto: "o" },
  { label: "Services", href: "/dashboard/services", icon: Server, goto: "s" },
  { label: "Orders", href: "/dashboard/orders", icon: ReceiptText, goto: "r" },
  { label: "Billing", href: "/dashboard/billing", icon: Wallet, goto: "b" },
  { label: "Support", href: "/dashboard/tickets", icon: LifeBuoy, goto: "t" },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell, badge: "unread", goto: "n" },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, goto: "e" },
];

export const isActive = (pathname: string, item: NavItem) =>
  item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

/** Words for the breadcrumb trail. Anything not listed (an id) shows as "Details". */
export const crumbLabels: Record<string, string> = {
  dashboard: "Overview",
  services: "Services",
  orders: "Orders",
  pay: "Payment",
  billing: "Billing",
  invoices: "Invoices",
  invoice: "Invoice",
  tickets: "Support",
  new: "New ticket",
  notifications: "Notifications",
  settings: "Settings",
};
