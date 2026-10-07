import {
  Boxes,
  ChartColumn,
  CreditCard,
  FilePen,
  FileText,
  Globe,
  Landmark,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  MapPin,
  Megaphone,
  ScrollText,
  Server,
  Settings,
  ShoppingCart,
  Tag,
  Ticket,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

export type BadgeKey = "payments" | "orders" | "tickets" | "inbox";

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Match only this exact path (otherwise nested routes light the item up too). */
  exact?: boolean;
  badge?: BadgeKey;
  /** Hidden from `support` (and refused by the page and the database). */
  adminOnly?: boolean;
  /** `g` then this letter jumps here. */
  goto?: string;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const adminNav: AdminNavGroup[] = [
  {
    label: "Operations",
    items: [
      { label: "Overview", href: "/admin", icon: LayoutDashboard, exact: true, goto: "o" },
      { label: "Payments", href: "/admin/payments", icon: CreditCard, badge: "payments", goto: "p" },
      { label: "Orders", href: "/admin/orders", icon: ShoppingCart, badge: "orders", goto: "r" },
      { label: "Services", href: "/admin/services", icon: Server, goto: "s" },
      { label: "Inventory", href: "/admin/inventory", icon: Boxes, adminOnly: true, goto: "y" },
      { label: "Customers", href: "/admin/customers", icon: Users, goto: "c" },
    ],
  },
  {
    label: "Support",
    items: [
      { label: "Tickets", href: "/admin/tickets", icon: LifeBuoy, badge: "tickets", goto: "t" },
      { label: "Inbox", href: "/admin/inbox", icon: Mail, badge: "inbox", goto: "i" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "Plans", href: "/admin/catalog/plans", icon: Layers, adminOnly: true, goto: "l" },
      { label: "Countries", href: "/admin/catalog/countries", icon: Globe, adminOnly: true, goto: "k" },
      { label: "Pricing & stock", href: "/admin/catalog/pricing", icon: Tag, adminOnly: true, goto: "x" },
      { label: "Locations", href: "/admin/catalog/locations", icon: MapPin, adminOnly: true },
      { label: "Payment methods", href: "/admin/payment-methods", icon: Landmark, adminOnly: true, goto: "m" },
      { label: "Coupons", href: "/admin/coupons", icon: Ticket, adminOnly: true },
    ],
  },
  {
    label: "Business",
    items: [
      { label: "Invoices", href: "/admin/invoices", icon: FileText, goto: "v" },
      { label: "Reports", href: "/admin/reports", icon: ChartColumn, adminOnly: true, goto: "e" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "FAQs", href: "/admin/content/faqs", icon: FilePen, adminOnly: true },
      { label: "Announcement", href: "/admin/content/announcement", icon: Megaphone, adminOnly: true },
      { label: "Team", href: "/admin/team", icon: UserCog, adminOnly: true },
      { label: "Audit log", href: "/admin/audit-log", icon: ScrollText, adminOnly: true, goto: "a" },
      { label: "Settings", href: "/admin/settings", icon: Settings, adminOnly: true, goto: "n" },
    ],
  },
];

export const isActive = (pathname: string, item: AdminNavItem) =>
  item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

/** Words for the breadcrumb trail. Anything not listed (an id) reads "Details". */
export const crumbLabels: Record<string, string> = {
  admin: "Admin",
  payments: "Payments",
  orders: "Orders",
  services: "Services",
  inventory: "Inventory",
  customers: "Customers",
  tickets: "Tickets",
  inbox: "Inbox",
  catalog: "Catalog",
  plans: "Plans",
  pricing: "Pricing & stock",
  countries: "Countries",
  locations: "Locations",
  "payment-methods": "Payment methods",
  coupons: "Coupons",
  invoices: "Invoices",
  reports: "Reports",
  content: "Content",
  faqs: "FAQs",
  announcement: "Announcement",
  team: "Team",
  "audit-log": "Audit log",
  settings: "Settings",
  new: "New",
  mfa: "Two-step verification",
};
