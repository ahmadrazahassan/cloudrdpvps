import type { Metadata } from "next";
import { SettingsForm, type SettingField } from "@/components/admin/content-forms";
import { CannedEditor, DeleteCanned } from "@/components/admin/editors";
import { AdminHeader } from "@/components/admin/parts";
import { TestEmail } from "@/components/admin/settings-extras";
import { LedgerSection } from "@/components/ledger/primitives";
import { Row, RowList } from "@/components/portal/cards";
import { requireAdminConsole } from "@/lib/admin/guard";
import { getCannedAdmin, getSettingsMap } from "@/lib/admin/queries-system";
import { emailConfigured } from "@/lib/email/send";

export const metadata: Metadata = { title: "Settings" };

const s = (v: unknown) => (typeof v === "string" ? v : "");
const n = (v: unknown, d: number) => String(typeof v === "number" ? v : d);

const GENERAL: SettingField[] = [
  { name: "site_name", label: "Site name", kind: "text" },
  { name: "support_email", label: "Support email", kind: "text", hint: "Shown in the footer, on the contact page and on invoices. Empty hides it." },
  { name: "whatsapp", label: "WhatsApp number", kind: "text", placeholder: "+92 300 1234567", hint: "Your WhatsApp number with its country code (or a wa.me link). Powers the chat button on every public page and the WhatsApp links. Empty hides all of them." },
  { name: "telegram", label: "Telegram link", kind: "text", placeholder: "https://t.me/yourname", hint: "A full https:// link. Empty hides it." },
  { name: "company_block", label: "Company details for invoices", kind: "textarea", hint: "Name, address and any tax number — printed on every invoice. One item per line." },
];
const ORDERS: SettingField[] = [
  { name: "unpaid_order_hours", label: "Cancel unpaid orders after (hours)", kind: "number" },
  { name: "reject_extension_hours", label: "Extra time after a rejected payment (hours)", kind: "number" },
  { name: "max_open_orders", label: "Most unpaid orders per customer", kind: "number" },
  { name: "grace_days", label: "Grace period after expiry (days)", kind: "number", hint: "Servers past this are flagged for you to terminate. Nothing is deleted automatically." },
  { name: "reminder_days", label: "Expiry reminders (days before)", kind: "text", hint: "e.g. 3, 1 — one email and notification at each." },
  { name: "review_eta", label: "Payment review time (shown to customers)", kind: "text", placeholder: "Usually within a few hours", hint: "Empty hides it. Don't promise what you can't keep." },
  { name: "delivery_eta", label: "Delivery time (shown on the site)", kind: "text", placeholder: "Usually within 24 hours of verification", hint: "Empty hides it." },
];
const OPERATIONS: SettingField[] = [
  { name: "maintenance_enabled", label: "Maintenance mode — pause new orders", kind: "check", hint: "Customers can still sign in and use their servers. Checkout refuses new orders and a banner shows on the site." },
  { name: "maintenance_message", label: "Message shown to visitors", kind: "text" },
  { name: "low_stock_threshold", label: "Low-stock warning at (servers)", kind: "number", hint: "The Inventory page warns when a product and location has this many or fewer servers available." },
];
const SECURITY: SettingField[] = [{ name: "require_staff_mfa", label: "Require two-step verification for staff", kind: "check", hint: "Strongly recommended. When on, admins and support must enter an authenticator code to use the console." }];

export default async function SettingsPage() {
  await requireAdminConsole();
  const [settings, canned] = await Promise.all([getSettingsMap(), getCannedAdmin()]);
  const maintenance = (settings.maintenance && typeof settings.maintenance === "object" ? settings.maintenance : {}) as Record<string, unknown>;
  const company = typeof settings.company_block === "string" ? settings.company_block : Array.isArray(settings.company_block) ? (settings.company_block as unknown[]).filter((x) => typeof x === "string").join("\n") : "";

  return (
    <>
      <AdminHeader title="Settings" description="Site contacts, ordering rules, maintenance mode, security and saved replies." />

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <div className="min-w-0 space-y-5">
          <LedgerSection title="General">
            <SettingsForm
              group="general"
              fields={GENERAL}
              initial={{ site_name: s(settings.site_name) || "Cloud RDP VPS", support_email: s(settings.support_email), whatsapp: s(settings.whatsapp), telegram: s(settings.telegram), company_block: company }}
            />
          </LedgerSection>
          <LedgerSection title="Operations">
            <SettingsForm group="operations" fields={OPERATIONS} initial={{ maintenance_enabled: maintenance.enabled === true, maintenance_message: s(maintenance.message), low_stock_threshold: n(settings.low_stock_threshold, 3) }} />
          </LedgerSection>
          <LedgerSection title="Security">
            <SettingsForm group="security" fields={SECURITY} initial={{ require_staff_mfa: settings.require_staff_mfa !== false }} />
          </LedgerSection>
        </div>
        <div className="min-w-0 space-y-5">
          <LedgerSection title="Orders">
            <SettingsForm
              group="orders"
              fields={ORDERS}
              initial={{
                unpaid_order_hours: n(settings.unpaid_order_hours, 48),
                reject_extension_hours: n(settings.reject_extension_hours, 24),
                max_open_orders: n(settings.max_open_orders, 3),
                grace_days: n(settings.grace_days, 2),
                reminder_days: Array.isArray(settings.reminder_days) ? (settings.reminder_days as number[]).join(", ") : "3, 1",
                review_eta: s(settings.review_eta),
                delivery_eta: s(settings.delivery_eta),
              }}
            />
          </LedgerSection>
          <LedgerSection title="Email">
            <TestEmail configured={emailConfigured()} />
          </LedgerSection>
        </div>
      </div>

      <LedgerSection flush title="Saved replies" aside={<CannedEditor />}>
        {canned.length === 0 ? (
          <p className="px-6 py-12 text-center text-[14px] text-muted">No saved replies yet. Add the answers you give most often.</p>
        ) : (
          <RowList>
            {canned.map((c) => (
              <Row key={c.id} className="flex flex-wrap items-start gap-x-5 gap-y-2">
                <div className="min-w-[240px] flex-1">
                  <p className="text-[15px] font-semibold text-ink">{c.title}</p>
                  <p className="mt-1 line-clamp-2 max-w-[80ch] whitespace-pre-wrap text-[13.5px] text-muted">{c.body_md}</p>
                </div>
                <CannedEditor reply={{ id: c.id, title: c.title, body_md: c.body_md }} />
                <DeleteCanned id={c.id} title={c.title} />
              </Row>
            ))}
          </RowList>
        )}
      </LedgerSection>
    </>
  );
}
