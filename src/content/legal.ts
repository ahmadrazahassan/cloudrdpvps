/**
 * Default legal text. It is written to match how the service really works
 * (manual payment, delivery after verification, 30-day plans, no auto-renewal)
 * and is a sensible starting point — NOT legal advice. The owner must have these
 * four documents reviewed by a lawyer for the places they operate in before launch
 * (see README → "Legal pages").
 */
export type LegalBlock = string | { list: string[] };

export interface LegalSection {
  id: string;
  title: string;
  body: LegalBlock[];
}

export interface LegalDoc {
  slug: "terms" | "privacy" | "acceptable-use" | "refund";
  title: string;
  /** Used for the page description and the /legal index. */
  summary: string;
  sections: LegalSection[];
}

/** Bump this whenever any document changes. */
export const legalUpdated = "4 October 2026";
export const legalUpdatedIso = "2026-10-04";

export const legalDocs: LegalDoc[] = [
  // -------------------------------------------------------------------------
  {
    slug: "terms",
    title: "Terms of Service",
    summary: "The agreement between you and Cloud RDP VPS when you create an account, place an order or use a server.",
    sections: [
      {
        id: "agreement",
        title: "1. Who we are and what these terms cover",
        body: [
          "Cloud RDP VPS (“we”, “us”) sells Windows RDP and Windows VPS servers. These Terms of Service apply when you create an account, place an order or use a server we provide.",
          "By doing any of those things you agree to these Terms and to our Privacy Policy, Acceptable Use Policy and Refund Policy, which form part of this agreement. If you don't agree, please don't use the service.",
        ],
      },
      {
        id: "account",
        title: "2. Your account",
        body: [
          "You must be old enough to enter a binding contract where you live, and the details you give us must be accurate and kept up to date.",
          "You are responsible for keeping your password secure and for everything that happens under your account. Tell us straight away if you think someone else has used it. We may suspend an account that breaches these Terms or that we reasonably believe has been compromised.",
        ],
      },
      {
        id: "plans",
        title: "3. Plans, prices and orders",
        body: [
          "Each plan lists its specifications and location. Every price is in US dollars and every plan runs for 30 days.",
          "The price shown when you place an order is the price you pay for that order. We may change prices for future orders, but never for an order you have already placed. We may decline or cancel an order — for example if a plan is out of stock or we suspect fraud — and if we do and you have already paid, we will refund what we received.",
        ],
      },
      {
        id: "payment",
        title: "4. Payment",
        body: [
          "Payment is manual. After you place an order, the order page shows the payment methods available for your region and how to pay. You send the full amount yourself and upload proof of payment, and our team verifies it.",
          "Transfer fees charged by your bank, wallet or network are your responsibility, and the amount we receive must cover the order total. Only pay using the details shown on your order page; we are not responsible for payments sent anywhere else.",
          "Orders that are not paid are cancelled automatically after the time shown on the order page. We never charge you automatically.",
        ],
      },
      {
        id: "delivery",
        title: "5. Delivery",
        body: [
          "Servers are set up by our team after we verify your payment. We then deliver your login details in your dashboard and notify you. Any delivery times we mention are estimates, not guarantees, and we do not offer instant delivery.",
          "Your 30-day term starts when your server is delivered.",
        ],
      },
      {
        id: "renewal",
        title: "6. Term, renewal and expiry",
        body: [
          "A plan lasts 30 days from delivery and does not renew automatically. To keep a server, place a renewal order and pay for it before the expiry date; the new 30 days are added to the end of your current term.",
          "When a term ends, we may suspend access to the server and your dashboard stops showing its login details. There is a short grace period in which you can still renew. After that we may remove the server and delete its data, so please keep your own copies of anything important.",
        ],
      },
      {
        id: "use",
        title: "7. Using your server",
        body: [
          "You get full administrator access to your server. In return you are responsible for:",
          {
            list: [
              "everything you install, store and run on it, and for holding the licences it needs beyond the Windows Server we provide;",
              "keeping it secure — strong passwords, software updates and sensible firewall settings;",
              "keeping your own backups of your data;",
              "using it lawfully and in line with our Acceptable Use Policy, including the actions of anyone you give access to.",
            ],
          },
        ],
      },
      {
        id: "availability",
        title: "8. Availability and support",
        body: [
          "We work to keep servers running, but we do not promise uninterrupted service. Maintenance, network problems and events outside our control can cause downtime, and we don't offer service credits unless we agree to them in writing.",
          "Support is by ticket from your dashboard (or through our contact page). Restarts and reinstalls are handled by our team on request.",
        ],
      },
      {
        id: "suspension",
        title: "9. Suspension and termination",
        body: [
          "We may suspend or terminate a server or account if you breach these Terms or our Acceptable Use Policy, if payment cannot be verified, if we need to for security reasons, or if the law requires it. For serious breaches we may act immediately and without notice.",
          "You can stop at any time by not renewing. To close your account, contact us; accounts with active servers can't be closed until the servers have expired or been terminated.",
        ],
      },
      {
        id: "refunds",
        title: "10. Refunds",
        body: ["Refunds are described in our Refund Policy."],
      },
      {
        id: "liability",
        title: "11. Liability",
        body: [
          "To the extent the law allows, the service is provided “as is”. We are not liable for indirect or consequential losses, or for loss of data, profits or business, arising from your use of the service.",
          "Our total liability to you for any claim relating to a server is limited to the amount you paid for that server's current term. Nothing in these Terms limits liability that cannot be limited by law.",
        ],
      },
      {
        id: "changes",
        title: "12. Changes to these terms",
        body: [
          "We may update these Terms from time to time. The “Last updated” date above shows the current version. If a change is significant we will tell you by email or in your dashboard. Continuing to use the service after a change means you accept it.",
        ],
      },
      {
        id: "law",
        title: "13. Governing law",
        body: [
          "These Terms are governed by the laws of the jurisdiction in which Cloud RDP VPS is established, without regard to conflict-of-law rules.",
        ],
      },
      {
        id: "contact",
        title: "14. Contact",
        body: ["Questions about these Terms? Reach us through the contact page and we'll get back to you."],
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    slug: "privacy",
    title: "Privacy Policy",
    summary: "What we collect, why we collect it, who we share it with and the choices you have.",
    sections: [
      {
        id: "overview",
        title: "1. What this policy covers",
        body: [
          "This policy explains how Cloud RDP VPS (“we”, “us”) handles personal information when you visit our website, create an account, place an order or use a server. We collect only what we need to run the service.",
        ],
      },
      {
        id: "collect",
        title: "2. What we collect",
        body: [
          {
            list: [
              "Account details — your name, email address and password (stored as a one-way hash by our authentication provider), plus optional details you add such as a phone number, billing country, company name, Telegram or WhatsApp.",
              "Orders and payments — the plans you order, amounts, the payment method you chose, the transaction reference, and the proof of payment you upload (an image or PDF).",
              "Server details — the login details we set up for your server. The password is encrypted before it is stored.",
              "Support — messages and attachments you send in tickets or through the contact form.",
              "Technical data — your IP address, browser type and timestamps, used for security, rate limiting and an audit log of important actions.",
            ],
          },
        ],
      },
      {
        id: "use",
        title: "3. How we use it",
        body: [
          {
            list: [
              "to create and secure your account;",
              "to take orders, verify payments and deliver and manage your servers;",
              "to answer support requests;",
              "to send service emails — order and payment updates, delivery, expiry reminders and ticket replies;",
              "to prevent fraud and abuse, and to meet our legal and accounting obligations.",
            ],
          },
          "We do not sell your personal information and we do not use it for advertising.",
        ],
      },
      {
        id: "sharing",
        title: "4. Who we share it with",
        body: [
          "We use a small number of service providers to run the site. They process data on our behalf and only for that purpose:",
          {
            list: [
              "our database, authentication and file-storage provider (Supabase);",
              "a bot-protection provider for our forms (Cloudflare Turnstile), when enabled;",
              "an email delivery provider, to send the service emails above;",
              "a rate-limiting provider, which sees IP addresses to throttle abuse.",
            ],
          },
          "Only staff who need it to do their job can see your orders, payment proofs and tickets. We may also disclose information where the law requires it or to protect our service from abuse.",
        ],
      },
      {
        id: "cookies",
        title: "5. Cookies",
        body: [
          "We use only the cookies the site needs to work: they keep you signed in and protect our forms. We do not use advertising or tracking cookies.",
        ],
      },
      {
        id: "security",
        title: "6. How we protect it",
        body: [
          "Server passwords are encrypted before they are stored and are revealed only to you, on request, in your dashboard. Payment proofs are kept in private storage. Access to data is restricted by role, and important actions are written to an audit log. No system is perfectly secure, but we take care to keep yours safe.",
        ],
      },
      {
        id: "retention",
        title: "7. How long we keep it",
        body: [
          "We keep your information while your account is active and for as long as we need it to provide the service, resolve disputes, prevent fraud and meet legal and accounting requirements.",
        ],
      },
      {
        id: "rights",
        title: "8. Your choices",
        body: [
          "You can ask us to show you the information we hold about you, correct it, or delete it. We can't delete records we are required to keep, and an account with active servers can't be closed until they have expired. To make a request, open a ticket from your dashboard or use our contact page.",
        ],
      },
      {
        id: "international",
        title: "9. Where data is processed",
        body: [
          "Our providers may process data in countries other than the one you live in. We choose providers that protect data appropriately.",
        ],
      },
      {
        id: "children",
        title: "10. Children",
        body: ["The service is not intended for anyone under 18, and we do not knowingly collect their information."],
      },
      {
        id: "changes",
        title: "11. Changes and contact",
        body: [
          "We may update this policy; the “Last updated” date above shows the current version. If you have questions, reach us through the contact page.",
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    slug: "acceptable-use",
    title: "Acceptable Use Policy",
    summary: "What you may and may not do with a server from Cloud RDP VPS.",
    sections: [
      {
        id: "purpose",
        title: "1. Why this policy exists",
        body: [
          "Every server shares a network with other customers and other people's systems. This policy keeps that network safe and usable. It applies to every server and every account, and breaking it can lead to suspension or termination.",
        ],
      },
      {
        id: "prohibited",
        title: "2. What is not allowed",
        body: [
          "You may not use a server, or let anyone else use it, to:",
          {
            list: [
              "send spam or other unsolicited bulk messages;",
              "launch or take part in denial-of-service (DDoS) or other attacks that disrupt a service or network;",
              "commit fraud, phishing, impersonation or any scam;",
              "host, spread or control malware, ransomware, botnets or command-and-control systems;",
              "attempt unauthorised access to systems, or scan and probe other people's networks;",
              "scrape websites abusively — for example ignoring a site's rules or rate limits, overloading it, or collecting private data;",
              "store, share or distribute illegal content, or any content that sexually exploits children — we report this to the authorities;",
              "infringe copyright, trademarks or other rights;",
              "do anything else that is unlawful or that harms our network, other customers or third parties.",
            ],
          },
        ],
      },
      {
        id: "responsibility",
        title: "3. You are responsible for your server",
        body: [
          "You are responsible for everything that happens on your server, including activity by people you give access to and activity caused by weak or stolen passwords. Keep your software up to date and your credentials private.",
        ],
      },
      {
        id: "reporting",
        title: "4. Reporting abuse",
        body: [
          "If you believe a server of ours is being used abusively, tell us through the contact page with as much detail as you can, such as the IP address and what you saw. We investigate every report.",
        ],
      },
      {
        id: "enforcement",
        title: "5. What happens if the policy is broken",
        body: [
          "We may investigate, ask you to fix a problem, or suspend or terminate a server or account. For serious breaches we may act immediately and without notice. Servers suspended or terminated for breaking this policy are not eligible for a refund.",
          "We may cooperate with law-enforcement and other authorities where the law requires it.",
        ],
      },
      {
        id: "changes",
        title: "6. Changes",
        body: [
          "We may update this policy; the “Last updated” date above shows the current version.",
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    slug: "refund",
    title: "Refund Policy",
    summary: "When we refund a payment, when we don't, and how to ask.",
    sections: [
      {
        id: "overview",
        title: "1. How refunds work",
        body: [
          "Payments to us are made manually, and so are refunds: each request is reviewed by our team. This policy explains what to expect.",
        ],
      },
      {
        id: "before-delivery",
        title: "2. Before your server is delivered",
        body: [
          "If your server has not been delivered, you can cancel the order and we will refund the amount we received for it. If we cancel an order — for example because the plan is out of stock — we will refund what we received.",
        ],
      },
      {
        id: "after-delivery",
        title: "3. After your server is delivered",
        body: [
          "Once a server is delivered we reserve its resources for the full 30-day term, so a delivered server is generally not refundable.",
          "If we can't deliver a working server as described, or a fault on our side can't be fixed within a reasonable time, we will put it right: we will repair or replace the server, extend your term, or refund the unused portion — whichever resolves the problem best. Please open a ticket as soon as you notice an issue so we can act quickly.",
        ],
      },
      {
        id: "not-refundable",
        title: "4. What is not refundable",
        body: [
          {
            list: [
              "servers suspended or terminated for breaking our Acceptable Use Policy;",
              "a change of mind after a server has been delivered and is working as described;",
              "plans that have already expired;",
              "problems caused by software or settings you installed or changed;",
              "transfer fees charged by your bank, wallet or network.",
            ],
          },
        ],
      },
      {
        id: "mistakes",
        title: "5. Overpayments and duplicates",
        body: [
          "If you pay more than the order total, or pay the same order twice, we will refund the difference or the duplicate once we have verified it.",
        ],
      },
      {
        id: "request",
        title: "6. How to ask for a refund",
        body: [
          "Open a ticket from your dashboard, or use our contact page if you can't sign in, and include your order number. We review each request and reply with our decision. Approved refunds are sent back using the same payment method where possible; how long they take to arrive depends on that method.",
        ],
      },
      {
        id: "changes",
        title: "7. Changes",
        body: [
          "We may update this policy; the “Last updated” date above shows the current version. The version in force when you placed an order applies to that order.",
        ],
      },
    ],
  },
];

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return legalDocs.find((d) => d.slug === slug);
}
