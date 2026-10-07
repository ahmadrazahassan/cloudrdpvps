/**
 * Site-wide configuration. Anything the owner controls from the admin
 * dashboard later (support contacts, announcement banner, ETAs) lives here
 * for now with safe empty defaults — empty means "do not render".
 */
export const site = {
  name: "Cloud RDP VPS",
  shortName: "CloudRDPVPS",
  tagline: "Windows RDP & VPS, delivered by people.",
  description:
    "Dedicated Windows RDP and Windows VPS servers in countries around the world. Simple 30-day plans, flat dollar pricing, and every server set up by our team.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  year: 2026,

  /** Set from admin → Settings → General (site_settings). Null hides the item. */
  supportEmail: null as string | null,
  telegram: null as string | null,
  whatsapp: null as string | null,

  /** site_settings.delivery_eta — render nothing when empty. */
  deliveryEta: null as string | null,

  /** site_settings.announcement */
  announcement: {
    enabled: false,
    text: "",
    href: "",
    tone: "info" as "info" | "warn",
  },
} as const;

export const nav = {
  // Header links beside the Products menu. Features, Support and FAQ live in the footer only.
  main: [
    { label: "Locations", href: "/locations" },
    { label: "Pricing", href: "/pricing" },
  ],
  footer: {
    Products: [
      { label: "Windows RDP", href: "/rdp" },
      { label: "Windows VPS", href: "/vps" },
      { label: "Pricing", href: "/pricing" },
      { label: "Features", href: "/features" },
    ],
    Locations: [
      { label: "United States", href: "/locations/united-states" },
      { label: "United Kingdom", href: "/locations/united-kingdom" },
      { label: "Germany", href: "/locations/germany" },
      { label: "Singapore", href: "/locations/singapore" },
      { label: "India", href: "/locations/india" },
    ],
    Company: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "FAQ", href: "/faq" },
      { label: "Log in", href: "/login" },
    ],
    Legal: [
      { label: "Terms of Service", href: "/legal/terms" },
      { label: "Privacy Policy", href: "/legal/privacy" },
      { label: "Acceptable Use", href: "/legal/acceptable-use" },
      { label: "Refund Policy", href: "/legal/refund" },
    ],
  },
} as const;
