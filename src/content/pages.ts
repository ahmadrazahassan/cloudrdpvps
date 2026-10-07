import {
  Briefcase,
  Clock,
  Cpu,
  Laptop,
  Monitor,
  Server,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import type { ImageKey } from "@/content/images";
import type { ProductType } from "@/content/catalog";

/**
 * Copy for the public pages. Everything here is written against the real
 * business rules (Windows only, 30-day plans, USD, manual payment, delivery
 * after verification). No statistics, uptime figures, testimonials or customer
 * counts appear anywhere — if a claim can't be verified it isn't made.
 */

// ---------------------------------------------------------------------------
// /rdp and /vps
// ---------------------------------------------------------------------------
export interface ProductPageContent {
  product: ProductType;
  label: string;
  path: "/rdp" | "/vps";
  image: ImageKey;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  h1: string;
  lede: string;
  audienceTitle: string;
  audience: { icon: LucideIcon; title: string; body: string }[];
  includes: string[];
  faqIds: string[];
  /** Short sentence for the "RDP or VPS?" comparison. */
  chooseIf: string;
}

export const productPages: Record<ProductType, ProductPageContent> = {
  rdp: {
    product: "rdp",
    label: "Windows RDP",
    path: "/rdp",
    image: "product-rdp",
    metaTitle: "Windows RDP — a Windows desktop you can reach from anywhere",
    metaDescription:
      "Windows RDP with full administrator access in countries around the world. Simple 30-day plans in US dollars, set up by our team after payment verification.",
    eyebrow: "WINDOWS RDP",
    h1: "A Windows desktop you can reach from anywhere.",
    lede: "Windows RDP is a ready-to-use Windows Server desktop with full administrator access. Connect from Windows, macOS, Android or iOS with the standard Remote Desktop client. We set it up and deliver your login after your payment is verified.",
    audienceTitle: "What people use Windows RDP for.",
    audience: [
      {
        icon: Monitor,
        title: "Trading platforms",
        body: "Keep your trading software running on a Windows machine you can reach from any device.",
      },
      {
        icon: Laptop,
        title: "Remote work",
        body: "One consistent Windows desktop for you or your team, whatever you connect from.",
      },
      {
        icon: Briefcase,
        title: "Everyday Windows apps",
        body: "Run the Windows-only applications you rely on without tying up your own computer.",
      },
      {
        icon: Terminal,
        title: "A clean desktop for testing",
        body: "Try software and settings on a fresh Windows environment, away from your own machine.",
      },
    ],
    includes: [
      "Windows Server, installed and ready to use",
      "Full administrator access",
      "An IPv4 address",
      "Remote Desktop on port 3389",
      "NVMe storage on every plan",
      "Set up by our team after payment verification",
    ],
    faqIds: ["connect", "admin-access", "delivery", "term"],
    chooseIf:
      "You want a ready-to-use Windows desktop for trading, remote work or everyday Windows applications.",
  },
  vps: {
    product: "vps",
    label: "Windows VPS",
    path: "/vps",
    image: "product-vps",
    metaTitle: "Windows VPS — a Windows server you fully control",
    metaDescription:
      "Windows VPS with dedicated resources and full administrator access in countries around the world. Simple 30-day plans in US dollars, set up by our team after payment verification.",
    eyebrow: "WINDOWS VPS",
    h1: "A Windows server you fully control.",
    lede: "Windows VPS is a Windows Server with dedicated resources and full administrator access, built for hosting, automation and heavier workloads. Larger plans add more cores, memory, storage and bandwidth. We set it up and deliver your login after your payment is verified.",
    audienceTitle: "What people use Windows VPS for.",
    audience: [
      {
        icon: Server,
        title: "Hosting Windows applications",
        body: "Run the Windows-based applications and services your business depends on, around the clock.",
      },
      {
        icon: Clock,
        title: "Automation and scheduled tasks",
        body: "Schedule jobs and scripts on a server that stays on, within our Acceptable Use Policy.",
      },
      {
        icon: Terminal,
        title: "Development and staging",
        body: "Build, test and stage on a Windows server with the same administrator access you would have on your own.",
      },
      {
        icon: Cpu,
        title: "Heavier workloads",
        body: "Step up to larger plans with more cores, memory, storage and bandwidth when a desktop isn't enough.",
      },
    ],
    includes: [
      "Windows Server, installed and ready to use",
      "Full administrator access",
      "An IPv4 address",
      "Remote Desktop on port 3389",
      "NVMe storage on every plan",
      "Set up by our team after payment verification",
    ],
    faqIds: ["admin-access", "restart", "connect", "renewal"],
    chooseIf:
      "You need more room: higher-spec plans for hosting, automation or heavier workloads.",
  },
};

// ---------------------------------------------------------------------------
// /locations/[slug]
// ---------------------------------------------------------------------------
export interface LocationCopy {
  /** One-line summary under the heading. */
  summary: string;
  goodFor: string[];
  /** Fallback sentence about paying, used until the owner activates real methods. */
  paymentNote: string;
}

const generalPaymentNote =
  "Payment options for this location are shown when you place an order, and our team verifies each payment before your server is delivered.";

export const locationCopy: Record<string, LocationCopy> = {
  india: {
    summary: "Windows servers in India, on the same simple 30-day plans as every location.",
    goodFor: [
      "You or your team are based in India",
      "You want a server in the same country as the people who use it",
      "You prefer paying by UPI or bank transfer where available",
    ],
    paymentNote:
      "UPI and bank transfer are supported where available. Payment options are shown when you place an order, and our team verifies each payment before your server is delivered.",
  },
  bangladesh: {
    summary: "Windows servers in Bangladesh, delivered and supported by our team.",
    goodFor: [
      "You or your team are based in Bangladesh",
      "You want a server in the same country as the people who use it",
      "You prefer paying with mobile wallets or bank transfer where available",
    ],
    paymentNote:
      "Mobile wallets and bank transfer are supported where available. Payment options are shown when you place an order, and our team verifies each payment before your server is delivered.",
  },
  "united-states": {
    summary: "Windows servers in the United States, on flat 30-day plans in US dollars.",
    goodFor: [
      "Your customers or team are in North America",
      "You want a server hosted in the United States",
      "You prefer paying by bank transfer or an international method",
    ],
    paymentNote: generalPaymentNote,
  },
  "united-kingdom": {
    summary: "Windows servers in the United Kingdom, on flat 30-day plans in US dollars.",
    goodFor: [
      "Your customers or team are in the UK or Europe",
      "You want a server hosted in the United Kingdom",
      "You prefer paying by bank transfer or an international method",
    ],
    paymentNote: generalPaymentNote,
  },
};

/** Locations the owner adds later get sensible copy without a code change. */
export function locationCopyFor(slug: string, name: string): LocationCopy {
  return (
    locationCopy[slug] ?? {
      summary: `Windows servers in ${name}, on the same simple 30-day plans as every location.`,
      goodFor: [
        `You or your team are based in ${name}`,
        "You want a server in the same country as the people who use it",
      ],
      paymentNote: generalPaymentNote,
    }
  );
}

// ---------------------------------------------------------------------------
// Connecting (used by /features and, later, the dashboard)
// ---------------------------------------------------------------------------
export interface ConnectGuide {
  id: string;
  os: string;
  client: string;
  steps: string[];
}

export const connectGuides: ConnectGuide[] = [
  {
    id: "windows",
    os: "Windows",
    client: "Remote Desktop Connection (built in)",
    steps: [
      "Press Start, type “Remote Desktop Connection” and open it.",
      "Enter the server's IP address and port from your dashboard, for example 203.0.113.10:3389.",
      "Choose Connect, then enter your username and password when asked.",
      "Accept the certificate prompt the first time you connect.",
    ],
  },
  {
    id: "macos",
    os: "macOS",
    client: "Windows App (free on the Mac App Store)",
    steps: [
      "Install Windows App from the Mac App Store and open it.",
      "Add a PC and enter the server's IP address and port.",
      "Add a user account with your username and password.",
      "Select the PC to connect.",
    ],
  },
  {
    id: "android",
    os: "Android",
    client: "Remote Desktop (free on Google Play)",
    steps: [
      "Install Microsoft Remote Desktop from Google Play.",
      "Add a PC and enter the server's IP address and port.",
      "Add a user account with your username and password.",
      "Tap the PC to connect.",
    ],
  },
  {
    id: "ios",
    os: "iPhone and iPad",
    client: "Remote Desktop (free on the App Store)",
    steps: [
      "Install Microsoft Remote Desktop from the App Store.",
      "Add a PC and enter the server's IP address and port.",
      "Add a user account with your username and password.",
      "Tap the PC to connect.",
    ],
  },
];

// ---------------------------------------------------------------------------
// /features — "what to expect" (honest limits, stated plainly)
// ---------------------------------------------------------------------------
export const expectations: { title: string; body: string }[] = [
  {
    title: "Delivery follows payment verification",
    body: "Servers are set up by our team, not provisioned instantly. You pay, upload your proof, and we deliver after we have verified it.",
  },
  {
    title: "Restarts and reinstalls are requests",
    body: "There are no self-service power buttons. Open a ticket from your dashboard and our team will do it for you.",
  },
  {
    title: "One operating system",
    body: "Every server runs Windows Server. There is no operating system to pick, and none to configure at checkout.",
  },
  {
    title: "Nothing renews on its own",
    body: "Each plan runs for 30 days. Renewing is a new order you place before the expiry date; we never charge you automatically.",
  },
];

// ---------------------------------------------------------------------------
// /about
// ---------------------------------------------------------------------------
export const aboutPrinciples: { title: string; body: string }[] = [
  {
    title: "Windows, done properly",
    body: "We sell one operating system. Every plan runs Windows Server, so there is less to choose, less to explain and less to go wrong.",
  },
  {
    title: "Prices you can read",
    body: "Everything is priced in US dollars and every plan runs for 30 days. The price you see when you choose a plan is the price you pay.",
  },
  {
    title: "People in the loop",
    body: "Orders are verified and servers are set up by our team. That is why delivery follows payment verification instead of an instant button, and why support is one ticket away.",
  },
  {
    title: "Rules in plain language",
    body: "Our Terms, Acceptable Use and Refund policies are written to be read. If something isn't allowed, or isn't refundable, we say so up front.",
  },
];

export const aboutWontDo: string[] = [
  "Renew or charge you automatically",
  "Promise instant delivery",
  "Publish uptime figures, user counts or reviews we can't stand behind",
  "Allow spam, DDoS, fraud, malware or abusive scraping on our servers",
];
