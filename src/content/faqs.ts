/**
 * FAQ content. The first eight mirror the seeded `faqs` table (prompts/04 §15);
 * the rest are written against the real business rules (manual payment, manual
 * delivery, 30-day plans, Windows only). Editable from Admin → Content later.
 *
 * `home: true` marks the entries shown on the homepage; /faq shows all of them.
 */
/** The built-in categories are listed below; an admin may add others, so the type is open. */
export type FaqCategory = string;

export const faqCategories: { id: FaqCategory; label: string; blurb: string }[] = [
  { id: "ordering", label: "Ordering & delivery", blurb: "From choosing a plan to receiving your login." },
  { id: "payments", label: "Payments & billing", blurb: "How manual payment works and what we charge." },
  { id: "servers", label: "Using your server", blurb: "Connecting, managing and getting help." },
  { id: "policies", label: "Policies", blurb: "Refunds, acceptable use and your data." },
];

export interface Faq {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
  home?: boolean;
}

export const faqs: Faq[] = [
  // ---- Ordering & delivery ----
  {
    id: "delivery",
    category: "ordering",
    home: true,
    question: "How long does delivery take?",
    answer:
      "Servers are delivered after we verify your payment. The typical time is shown on your order page, and we notify you by email and in your dashboard as soon as your server is ready.",
  },
  {
    id: "how-to-order",
    category: "ordering",
    question: "How do I place an order?",
    answer:
      "Pick a plan and a location, sign in or create an account, and place the order. The order page then shows how to pay. Once you have paid and uploaded your proof, our team verifies it and sets up your server.",
  },
  {
    id: "term",
    category: "ordering",
    home: true,
    question: "How does the 30-day term work?",
    answer:
      "A plan runs for 30 days from delivery. Renew from your dashboard before it expires to add another 30 days.",
  },
  {
    id: "renewal",
    category: "ordering",
    question: "Do plans renew automatically?",
    answer:
      "No. Nothing renews on its own and we never charge you automatically. Renewing is a new order that you place and pay for before the expiry date; the extra 30 days are added to the end of your current term.",
  },
  {
    id: "expiry",
    category: "ordering",
    question: "What happens when a plan expires?",
    answer:
      "When the term ends, your dashboard stops showing the login details and access to the server can be suspended. There is a short grace period in which you can still renew. After that we may remove the server and its data, so keep your own copies of anything important.",
  },
  {
    id: "unpaid",
    category: "ordering",
    question: "What if I place an order but don't pay?",
    answer:
      "Unpaid orders are cancelled automatically after the time shown on the order page. You are never charged by us — you send the payment yourself — so an unpaid order costs nothing.",
  },
  {
    id: "location",
    category: "ordering",
    home: true,
    question: "Can I change my server's location later?",
    answer:
      "Locations are fixed per server. To move, order a new server in the location you need.",
  },

  // ---- Payments & billing ----
  {
    id: "payments",
    category: "payments",
    home: true,
    question: "Which payment methods do you accept?",
    answer:
      "We accept manual payments such as bank transfer, mobile wallets, UPI and crypto, depending on your region. Choose a method at checkout, send the payment, and upload proof.",
  },
  {
    id: "cards",
    category: "payments",
    question: "Can I pay by card?",
    answer:
      "Not at the moment. Payments are made manually with the methods shown on your order page for your region.",
  },
  {
    id: "currency",
    category: "payments",
    question: "What currency are prices in?",
    answer:
      "Every price is in US dollars. For some payment methods the order page also shows the amount to send in your local currency, based on a rate we set.",
  },
  {
    id: "verification",
    category: "payments",
    question: "How is my payment verified?",
    answer:
      "You upload a screenshot or receipt of your payment together with the transaction reference. A member of our team checks it against what we received. If something doesn't match, we tell you why and you can submit new proof.",
  },

  // ---- Using your server ----
  {
    id: "os",
    category: "servers",
    home: true,
    question: "What operating system do you provide?",
    answer:
      "Every server runs Windows. We currently offer a single Windows Server image on all plans.",
  },
  {
    id: "connect",
    category: "servers",
    home: true,
    question: "How do I connect to my server?",
    answer:
      "Use Remote Desktop Connection on Windows, Windows App on macOS, or the Remote Desktop app on Android and iOS, with the IP address, port, username and password shown in your dashboard.",
  },
  {
    id: "admin-access",
    category: "servers",
    question: "Do I get administrator access?",
    answer:
      "Yes. Every plan includes full administrator access, so you can install and configure software yourself, within our Acceptable Use Policy.",
  },
  {
    id: "restart",
    category: "servers",
    question: "Can I restart or reinstall my server myself?",
    answer:
      "Servers are managed by our team, so restarts and reinstalls are requests rather than buttons. Open a ticket from your dashboard and we will take care of it.",
  },

  // ---- Policies ----
  {
    id: "refunds",
    category: "policies",
    home: true,
    question: "Can I get a refund?",
    answer:
      "Refund eligibility is described in our Refund Policy. Refunds are handled manually by our team.",
  },
  {
    id: "abuse",
    category: "policies",
    home: true,
    question: "What is not allowed?",
    answer:
      "Spam, DDoS, fraud, malware and other abuse prohibited by our Acceptable Use Policy lead to suspension without refund.",
  },
  {
    id: "privacy",
    category: "policies",
    question: "How are my details and server login stored?",
    answer:
      "Server passwords are encrypted before they are stored and are only shown to you on request in your dashboard. Payment proofs are kept in private storage. Our Privacy Policy explains what else we keep and why.",
  },
];

export const homeFaqs = faqs.filter((f) => f.home);
