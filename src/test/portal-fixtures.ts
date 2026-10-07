import type {
  Invoice,
  Notification,
  Order,
  Payment,
  PaymentMethodRow,
  Service,
  Ticket,
  TicketMessage,
} from "@/lib/portal/queries";
import type { Tables } from "@/types/database";

/**
 * Realistic customer data for rendering every portal screen without a database.
 * Timestamps are relative to FIXED_NOW so snapshots (and the tests that read them) don't drift.
 */
export const FIXED_NOW = Date.UTC(2026, 9, 4, 12, 0, 0);
const day = 86_400_000;
const iso = (offsetMs: number) => new Date(FIXED_NOW + offsetMs).toISOString();

export const USER_ID = "11111111-1111-4111-8111-111111111111";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// Seeded catalog ids are slugs in the fallback catalog; the fixtures reuse them.
const IN_LOC = "india";
const US = "united-states";

export const profile: Tables<"profiles"> = {
  id: USER_ID,
  email: "aisha.khan@example.com",
  full_name: "Aisha Khan",
  phone: "+92 300 1234567",
  billing_country: "PK",
  company: "Khan Trading",
  telegram: "@aishak",
  whatsapp: null,
  role: "customer",
  status: "active",
  suspended_reason: null,
  notification_prefs: { ticket_replies: true, marketing: false },
  last_seen_at: null,
  created_at: iso(-90 * day),
  updated_at: iso(-1 * day),
};

const specs = (vcpu: number, ram: number, storage: number, bw = 4, port = 200) => ({
  vcpu,
  ram_gb: ram,
  storage_gb: storage,
  bandwidth_tb: bw,
  port_mbps: port,
  features: ["Full administrator access"],
});

export const orders: Order[] = [
  base({ n: 1, status: "awaiting_payment", plan: "RDP Standard", product: "rdp", location: IN_LOC, total: 1200, created: -3_600_000 * 5, expires: 3_600_000 * 43 }),
  base({ n: 2, status: "under_review", plan: "VPS M", product: "vps", location: US, total: 2200, created: -2 * day }),
  base({ n: 3, status: "completed", plan: "RDP Pro", product: "rdp", location: IN_LOC, total: 2200, created: -9 * day }),
  base({ n: 4, status: "rejected", plan: "RDP Starter", product: "rdp", location: IN_LOC, total: 600, created: -3 * day, expires: day }),
  base({ n: 5, status: "cancelled", plan: "VPS S", product: "vps", location: "germany", total: 800, created: -20 * day, cancelled: -19 * day }),
  base({ n: 6, status: "completed", plan: "VPS L", product: "vps", location: US, total: 3600, created: -40 * day, type: "renewal", discount: 400, coupon: "WELCOME10" }),
];

function base(o: {
  n: number;
  status: Order["status"];
  plan: string;
  product: "rdp" | "vps";
  location: string;
  total: number;
  created: number;
  expires?: number;
  cancelled?: number;
  type?: Order["type"];
  discount?: number;
  coupon?: string;
}): Order {
  const list = o.total + (o.discount ?? 0);
  return {
    id: id(100 + o.n),
    order_number: `CRV-00${1000 + o.n}`,
    user_id: USER_ID,
    type: o.type ?? "new",
    service_id: null,
    plan_id: `${o.product}-${o.plan.split(" ")[1]?.toLowerCase()}`,
    location_id: o.location,
    product: o.product,
    plan_name: o.plan,
    plan_specs: specs(4, 8, 120),
    location_name: o.location === IN_LOC ? "India" : o.location === US ? "United States" : "Germany",
    list_price_cents: list,
    discount_cents: o.discount ?? 0,
    total_cents: o.total,
    currency: "USD",
    term_days: 30,
    coupon_id: null,
    coupon_code: o.coupon ?? null,
    status: o.status,
    expires_at: iso(o.expires ?? 48 * 3_600_000),
    assigned_to: null,
    completed_at: o.status === "completed" ? iso(o.created + 3_600_000 * 20) : null,
    cancelled_at: o.cancelled !== undefined ? iso(o.cancelled) : null,
    created_at: iso(o.created),
    updated_at: iso(o.created),
  };
}

export const services: Service[] = [
  svc({ n: 1, label: "Trading-1", product: "rdp", plan: "RDP Standard", ip: "203.0.113.10", location: IN_LOC, expiresIn: 21, status: "active", orderN: 3 }),
  svc({ n: 2, label: "Build server", product: "vps", plan: "VPS L", ip: "198.51.100.24", location: US, expiresIn: 3, status: "active", orderN: 6 }),
  svc({ n: 3, label: "Staging", product: "vps", plan: "VPS S", ip: "192.0.2.77", location: "germany", expiresIn: -2, status: "active", orderN: 5 }),
  svc({ n: 4, label: "Paused desktop", product: "rdp", plan: "RDP Starter", ip: "203.0.113.99", location: IN_LOC, expiresIn: 12, status: "suspended", orderN: 4, reason: "Awaiting a response to an abuse report." }),
];

function svc(o: {
  n: number;
  label: string;
  product: "rdp" | "vps";
  plan: string;
  ip: string;
  location: string;
  expiresIn: number;
  status: Service["status"];
  orderN: number;
  reason?: string;
}): Service {
  return {
    id: id(200 + o.n),
    user_id: USER_ID,
    order_id: id(100 + o.orderN),
    plan_id: o.plan.toLowerCase().replace(" ", "-"), // "RDP Standard" -> "rdp-standard" (the seed catalog ids)
    location_id: o.location,
    product: o.product,
    plan_name: o.plan,
    plan_specs: specs(o.product === "vps" ? 8 : 4, o.product === "vps" ? 16 : 8, o.product === "vps" ? 320 : 120, 6, 500),
    label: o.label,
    hostname: null,
    ip: o.ip,
    rdp_port: 3389,
    status: o.status,
    suspended_reason: o.reason ?? null,
    started_at: iso(-30 * day),
    expires_at: iso(o.expiresIn * day),
    terminated_at: null,
    inventory_item_id: null,
    created_at: iso(-30 * day),
    updated_at: iso(-1 * day),
  };
}

export const payments: Payment[] = [
  pay({ n: 1, orderN: 2, status: "pending", method: "Bank transfer (Pakistan)", amount: 2200, reference: "TXN-884201" }),
  pay({ n: 2, orderN: 3, status: "verified", method: "JazzCash", amount: 2200, reference: "JC-77421", rate: 285 }),
  pay({ n: 3, orderN: 4, status: "rejected", method: "UPI", amount: 600, reject: "The amount received was lower than the order total." }),
];

function pay(o: {
  n: number;
  orderN: number;
  status: Payment["status"];
  method: string;
  amount: number;
  reference?: string;
  rate?: number;
  reject?: string;
}): Payment {
  return {
    id: id(300 + o.n),
    order_id: id(100 + o.orderN),
    user_id: USER_ID,
    method_id: id(400 + o.n),
    method_name: o.method,
    amount_usd_cents: o.amount,
    quoted_currency: o.rate ? "PKR" : null,
    quoted_amount: o.rate ? (o.amount / 100) * o.rate : null,
    quoted_rate: o.rate ?? null,
    reference: o.reference ?? null,
    note: null,
    proof_path: `${USER_ID}/${id(100 + o.orderN)}/proof-${o.n}.png`,
    proof_sha256: "a".repeat(64),
    proof_mime: "image/png",
    proof_size: 120_000,
    status: o.status,
    received_usd_cents: o.status === "verified" ? o.amount : null,
    reject_reason: o.reject ? "amount_mismatch" : null,
    reject_message: o.reject ?? null,
    reviewed_by: null,
    reviewed_at: o.status === "pending" ? null : iso(-1 * day),
    created_at: iso(-2 * day + o.n * 3_600_000),
  };
}

export const invoices: Invoice[] = [
  {
    id: id(500),
    invoice_number: "INV-001001",
    order_id: id(103),
    payment_id: id(302),
    user_id: USER_ID,
    subtotal_cents: 2200,
    discount_cents: 0,
    total_cents: 2200,
    currency: "USD",
    status: "paid",
    void_reason: null,
    issued_at: iso(-8 * day),
    billing_snapshot: {
      name: "Aisha Khan",
      email: "aisha.khan@example.com",
      country: "PK",
      company: "Khan Trading",
      order_number: "CRV-001003",
      items: [{ description: "RDP Pro — Pakistan (30 days)", amount_cents: 2200 }],
      discount_code: null,
      company_block: null,
    },
  },
  {
    id: id(501),
    invoice_number: "INV-001002",
    order_id: id(106),
    payment_id: null,
    user_id: USER_ID,
    subtotal_cents: 4000,
    discount_cents: 400,
    total_cents: 3600,
    currency: "USD",
    status: "paid",
    void_reason: null,
    issued_at: iso(-39 * day),
    billing_snapshot: {
      name: "Aisha Khan",
      email: "aisha.khan@example.com",
      country: "PK",
      company: null,
      order_number: "CRV-001006",
      items: [{ description: "VPS L — USA (30 days)", amount_cents: 4000 }],
      discount_code: "WELCOME10",
      company_block: null,
    },
  },
];

export const tickets: Ticket[] = [
  tk({ n: 1, no: 48, subject: "I can't connect to Trading-1", status: "awaiting_customer", category: "cannot_connect", service: id(201) }),
  tk({ n: 2, no: 41, subject: "Restart my build server", status: "open", category: "restart_request", service: id(202) }),
  tk({ n: 3, no: 30, subject: "Invoice for last month", status: "resolved", category: "billing", service: null }),
];

function tk(o: { n: number; no: number; subject: string; status: Ticket["status"]; category: Ticket["category"]; service: string | null }): Ticket {
  return {
    id: id(600 + o.n),
    ticket_no: o.no,
    user_id: USER_ID,
    service_id: o.service,
    subject: o.subject,
    category: o.category,
    priority: "normal",
    status: o.status,
    assigned_to: null,
    last_message_at: iso(-o.n * 5 * 3_600_000),
    last_customer_message_at: iso(-o.n * 6 * 3_600_000),
    last_staff_message_at: o.status === "awaiting_customer" ? iso(-o.n * 5 * 3_600_000) : null,
    resolved_at: o.status === "resolved" ? iso(-2 * day) : null,
    closed_at: null,
    created_at: iso(-3 * day),
    updated_at: iso(-1 * day),
  };
}

export const ticketMessages: TicketMessage[] = [
  msg(1, "customer", "Hi, I can't connect to my server since this morning. The Remote Desktop client says it can't find the computer. I haven't changed anything.", []),
  msg(2, "support", "Thanks for the details. We checked the server and it is running. Could you confirm the IP address you are using, and attach a screenshot of the error?", []),
  msg(3, "customer", "Using 203.0.113.10 on port 3389. Screenshot attached.", [
    { path: `${id(601)}/shot.png`, name: "error-screenshot.png", mime: "image/png", size: 88_000 },
  ]),
];

function msg(n: number, role: TicketMessage["author_role"], body: string, attachments: unknown[]): TicketMessage {
  return {
    id: id(700 + n),
    ticket_id: id(601),
    author_id: role === "customer" ? USER_ID : null,
    author_role: role,
    body,
    is_internal: false,
    attachments: attachments as TicketMessage["attachments"],
    created_at: iso(-30 * 3_600_000 + n * 3_600_000 * 4),
  };
}

export const notifications: Notification[] = [
  note(1, "payment_rejected", "Payment for CRV-001004 was rejected", "The amount received was lower than the order total.", `/dashboard/orders/${id(104)}`, false, -2 * 3_600_000),
  note(2, "ticket_reply", "New reply on ticket #48", "Thanks for the details. We checked the server…", `/dashboard/tickets/${id(601)}`, false, -5 * 3_600_000),
  note(3, "expiring_soon", "“Build server” expires in 3 days", "Renew before it expires to keep it running.", `/dashboard/services/${id(202)}`, true, -1 * day),
  note(4, "service_delivered", "Your server is ready", "“Trading-1” was delivered.", `/dashboard/services/${id(201)}`, true, -9 * day),
  note(5, "order_placed", "Order CRV-001001 placed", "Pay for your order to have your server delivered.", `/dashboard/orders/${id(101)}`, true, -5 * 3_600_000),
];

function note(n: number, type: string, title: string, body: string, link: string, read: boolean, at: number): Notification {
  return {
    id: id(800 + n),
    user_id: USER_ID,
    type,
    title,
    body,
    link,
    data: {},
    read_at: read ? iso(at + 3_600_000) : null,
    created_at: iso(at),
  };
}

export const paymentMethods: PaymentMethodRow[] = [
  method({
    n: 1,
    name: "Bank transfer (Pakistan)",
    type: "bank",
    regions: ["PK"],
    currency: "PKR",
    rate: 285,
    details: [
      { label: "Bank", value: "Example Bank Ltd" },
      { label: "Account title", value: "Cloud RDP VPS" },
      { label: "IBAN", value: "PK36 EXAM 0000 0012 3456 7890" },
    ],
    instructions: "Send from your own bank account.\n\n- Use the **order number** as the payment note.\n- Keep the receipt for your proof.",
    reference: true,
  }),
  method({ n: 2, name: "JazzCash", type: "mobile_wallet", regions: ["PK"], currency: "PKR", rate: 285, details: [{ label: "Wallet number", value: "0300 1234567" }, { label: "Account name", value: "Cloud RDP" }] }),
  method({ n: 3, name: "USDT (TRC20)", type: "crypto", regions: [], currency: null, rate: null, details: [{ label: "Network", value: "TRON (TRC20)" }, { label: "Address", value: "TXyzExampleAddress1234567890abcdefgh" }], reference: true }),
];

function method(o: {
  n: number;
  name: string;
  type: PaymentMethodRow["type"];
  regions: string[];
  currency: string | null;
  rate: number | null;
  details: { label: string; value: string }[];
  instructions?: string;
  reference?: boolean;
}): PaymentMethodRow {
  return {
    id: id(400 + o.n),
    name: o.name,
    type: o.type,
    regions: o.regions,
    currency_code: o.currency,
    rate_per_usd: o.rate,
    rate_updated_at: null,
    fee_note: o.type === "crypto" ? "Network fee applies" : null,
    details: o.details,
    qr_path: null,
    instructions_md: o.instructions ?? null,
    requires_reference: o.reference ?? false,
    sort_order: o.n,
    is_active: true,
    created_at: iso(-60 * day),
    updated_at: iso(-60 * day),
  };
}

export const orderEvents = (orderN: number) => {
  const oid = id(100 + orderN);
  const mk = (n: number, event: string, to: Order["status"] | null, at: number) => ({
    id: n,
    order_id: oid,
    actor_id: null,
    event,
    from_status: null,
    to_status: to,
    data: null,
    created_at: iso(at),
  });
  return [
    mk(1, "created", "awaiting_payment", -9 * day),
    mk(2, "payment_submitted", "under_review", -9 * day + 3_600_000),
    mk(3, "approved", "approved", -9 * day + 3_600_000 * 8),
    mk(4, "delivered", "completed", -9 * day + 3_600_000 * 20),
  ];
};
