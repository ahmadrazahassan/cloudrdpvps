"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/portal/confirm-dialog";
import { Button } from "@/components/ui/button";
import { deleteCannedResponse, deleteFaq, saveCannedResponse, saveFaq } from "@/lib/admin/actions/content";
import { savePaymentMethod, savePlan, saveLocation, saveCoupon, setPaymentMethodActive } from "@/lib/admin/actions/catalog";
import { addStaff, setStaffActive, setStaffRole } from "@/lib/admin/actions/system";
import { centsToInput } from "@/lib/admin/money";
import type { Coupon, Faq, Location, PaymentMethod, Plan } from "@/lib/admin/queries-system";
import { ActionDialog } from "./action-dialog";

const on = (v: boolean | undefined, fallback = false) => ((v ?? fallback) ? "on" : "");
const edit = (
  <Button size="sm" variant="ghost">
    Edit
  </Button>
);

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------
export function PlanEditor({ plan }: { plan?: Plan }) {
  return (
    <ActionDialog
      size="lg"
      trigger={plan ? edit : <Button size="sm">New plan</Button>}
      title={plan ? `Edit ${plan.name}` : "New plan"}
      description="A plan is a spec template. Windows is implied on every plan. Prices and stock are set per location on the Pricing & stock page."
      confirmLabel="Save plan"
      fields={[
        { kind: "select", name: "product", label: "Product", half: true, required: true, options: [{ value: "rdp", label: "RDP" }, { value: "vps", label: "VPS" }], defaultValue: plan?.product ?? "" },
        { kind: "text", name: "name", label: "Name", half: true, required: true, defaultValue: plan?.name ?? "" },
        { kind: "text", name: "slug", label: "Slug", half: true, hint: "Lowercase, used in links — e.g. starter", defaultValue: plan?.slug ?? "" },
        { kind: "text", name: "sort_order", label: "Display order", half: true, inputMode: "numeric", defaultValue: String(plan?.sort_order ?? 0) },
        { kind: "text", name: "vcpu", label: "vCPU", half: true, inputMode: "numeric", defaultValue: plan ? String(plan.vcpu) : "" },
        { kind: "text", name: "ram_gb", label: "RAM (GB)", half: true, inputMode: "numeric", defaultValue: plan ? String(plan.ram_gb) : "" },
        { kind: "text", name: "storage_gb", label: "NVMe storage (GB)", half: true, inputMode: "numeric", defaultValue: plan ? String(plan.storage_gb) : "" },
        { kind: "text", name: "bandwidth_tb", label: "Bandwidth (TB)", half: true, inputMode: "decimal", defaultValue: plan ? String(plan.bandwidth_tb) : "" },
        { kind: "text", name: "port_mbps", label: "Port speed (Mbps)", half: true, inputMode: "numeric", defaultValue: plan ? String(plan.port_mbps) : "" },
        { kind: "textarea", name: "features", label: "Feature bullets", hint: "One per line, up to 6.", defaultValue: (plan?.features ?? []).join("\n") },
        { kind: "check", name: "is_featured", label: "Highlight this plan as featured", half: true, defaultValue: on(plan?.is_featured) },
        { kind: "check", name: "is_active", label: "Show on the site", half: true, defaultValue: on(plan?.is_active, true) },
      ]}
      onSubmit={(v) =>
        savePlan({
          id: plan?.id ?? "",
          product: v.product as "rdp",
          name: v.name ?? "",
          slug: v.slug || (v.name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          vcpu: v.vcpu,
          ram_gb: v.ram_gb,
          storage_gb: v.storage_gb,
          bandwidth_tb: v.bandwidth_tb,
          port_mbps: v.port_mbps,
          features: v.features ?? "",
          is_featured: v.is_featured === "on",
          sort_order: v.sort_order,
          is_active: v.is_active === "on",
        })
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------
export function LocationEditor({ location, activePricing = 0 }: { location?: Location; activePricing?: number }) {
  return (
    <ActionDialog
      size="lg"
      trigger={location ? edit : <Button size="sm">New location</Button>}
      title={location ? `Edit ${location.name}` : "New location"}
      description={
        location && activePricing > 0 ? `${activePricing} active price${activePricing === 1 ? "" : "s"} use this location. Switching it off hides them from the site and from checkout.` : "Locations appear on the public site and in checkout."
      }
      confirmLabel="Save location"
      fields={[
        { kind: "text", name: "name", label: "Name", half: true, required: true, defaultValue: location?.name ?? "" },
        { kind: "text", name: "slug", label: "Slug", half: true, hint: "e.g. germany", defaultValue: location?.slug ?? "" },
        { kind: "text", name: "iso2", label: "Country code", half: true, hint: "2 letters, e.g. PK", defaultValue: location?.iso2?.trim() ?? "" },
        { kind: "text", name: "sort_order", label: "Display order", half: true, inputMode: "numeric", defaultValue: String(location?.sort_order ?? 0) },
        { kind: "textarea", name: "blurb", label: "Short description (optional)", defaultValue: location?.blurb ?? "" },
        { kind: "text", name: "image_key", label: "Image key (optional)", hint: "Name of a bundled site image.", defaultValue: location?.image_key ?? "" },
        { kind: "check", name: "is_active", label: "Show on the site", defaultValue: on(location?.is_active, true) },
      ]}
      onSubmit={(v) =>
        saveLocation({
          id: location?.id ?? "",
          name: v.name ?? "",
          slug: v.slug || (v.name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          iso2: v.iso2 ?? "",
          blurb: v.blurb,
          image_key: v.image_key,
          sort_order: v.sort_order,
          is_active: v.is_active === "on",
        })
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Payment methods
// ---------------------------------------------------------------------------
const METHOD_TYPES = [
  { value: "bank", label: "Bank transfer" },
  { value: "mobile_wallet", label: "Mobile wallet" },
  { value: "upi", label: "UPI" },
  { value: "crypto", label: "Crypto" },
  { value: "other", label: "Other" },
];

export function MethodEditor({ method }: { method?: PaymentMethod }) {
  const detailLines = Array.isArray(method?.details)
    ? (method!.details as unknown[])
        .flatMap((d) => {
          const r = d as Record<string, unknown>;
          return typeof r?.label === "string" && typeof r?.value === "string" ? [`${r.label}: ${r.value}`] : [];
        })
        .join("\n")
    : "";
  return (
    <ActionDialog
      size="lg"
      trigger={method ? edit : <Button size="sm">New method</Button>}
      title={method ? `Edit ${method.name}` : "New payment method"}
      description="Customers see the account details and instructions on their order's payment page. Keep a method switched off until its details are real."
      confirmLabel="Save method"
      fields={[
        { kind: "text", name: "name", label: "Name", half: true, required: true, defaultValue: method?.name ?? "" },
        { kind: "select", name: "type", label: "Type", half: true, required: true, options: METHOD_TYPES, defaultValue: method?.type ?? "" },
        { kind: "text", name: "regions", label: "Available in", half: true, hint: "Country codes, e.g. PK, IN. Empty = everywhere.", defaultValue: (method?.regions ?? []).map((r) => r.trim()).join(", ") },
        { kind: "text", name: "sort_order", label: "Display order", half: true, inputMode: "numeric", defaultValue: String(method?.sort_order ?? 0) },
        { kind: "text", name: "currency_code", label: "Currency", half: true, hint: "e.g. PKR. Empty = USD.", defaultValue: method?.currency_code?.trim() ?? "" },
        { kind: "text", name: "rate_per_usd", label: "Rate per 1 USD", half: true, inputMode: "decimal", hint: "e.g. 285", defaultValue: method?.rate_per_usd != null ? String(method.rate_per_usd) : "" },
        { kind: "text", name: "fee_note", label: "Fee note (optional)", defaultValue: method?.fee_note ?? "" },
        { kind: "textarea", name: "details", label: "Account details", hint: "One per line as “Label: value” — e.g. Account name: Cloud RDP", defaultValue: detailLines },
        { kind: "textarea", name: "instructions_md", label: "Instructions (optional)", defaultValue: method?.instructions_md ?? "" },
        { kind: "check", name: "requires_reference", label: "Ask for a transaction reference", half: true, defaultValue: on(method?.requires_reference) },
        { kind: "check", name: "is_active", label: "Available to customers", half: true, defaultValue: on(method?.is_active) },
      ]}
      onSubmit={(v) =>
        savePaymentMethod({
          id: method?.id ?? "",
          name: v.name ?? "",
          type: v.type as "bank",
          regions: v.regions ?? "",
          currency_code: v.currency_code ?? "",
          rate_per_usd: v.rate_per_usd ?? "",
          fee_note: v.fee_note,
          details: v.details ?? "",
          instructions_md: v.instructions_md,
          requires_reference: v.requires_reference === "on",
          sort_order: v.sort_order,
          is_active: v.is_active === "on",
        })
      }
    />
  );
}

/** One-click on/off for a payment method, next to its name. */
export function MethodActiveToggle({ id, name, active }: { id: string; name: string; active: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <label className="check !items-center !gap-2">
        <input
          type="checkbox"
          checked={active}
          disabled={pending}
          aria-label={`${name} is available to customers`}
          className="!mt-0"
          onChange={(e) =>
            start(async () => {
              setError(null);
              const r = await setPaymentMethodActive({ id, active: e.target.checked });
              if (!r.ok) setError(r.message);
            })
          }
        />
        <span className="text-[13px]">{active ? "On" : "Off"}</span>
      </label>
      {error && <span className="field-error">{error}</span>}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

export function CouponEditor({ coupon }: { coupon?: Coupon }) {
  return (
    <ActionDialog
      size="lg"
      trigger={coupon ? edit : <Button size="sm">New coupon</Button>}
      title={coupon ? `Edit ${coupon.code}` : "New coupon"}
      description="Codes aren't case-sensitive and must be unique. A coupon can never make an order free."
      confirmLabel="Save coupon"
      fields={[
        { kind: "text", name: "code", label: "Code", half: true, required: true, defaultValue: () => coupon?.code ?? generateCode() },
        { kind: "select", name: "type", label: "Type", half: true, required: true, options: [{ value: "percent", label: "Percent off" }, { value: "fixed_usd", label: "Dollars off" }], defaultValue: coupon?.type ?? "percent" },
        { kind: "text", name: "value", label: "Value", half: true, inputMode: "decimal", hint: "Percent (1–100) or dollars", required: true, defaultValue: coupon ? (coupon.type === "percent" ? String(coupon.value) : centsToInput(coupon.value)) : "" },
        { kind: "select", name: "applies_product", label: "Applies to", half: true, options: [{ value: "", label: "Every product" }, { value: "rdp", label: "RDP only" }, { value: "vps", label: "VPS only" }], defaultValue: coupon?.applies_product ?? "" },
        { kind: "text", name: "min_order", label: "Minimum order (USD)", half: true, inputMode: "decimal", hint: "Empty = none", defaultValue: coupon && coupon.min_order_cents > 0 ? centsToInput(coupon.min_order_cents) : "" },
        { kind: "text", name: "max_redemptions", label: "Max total uses", half: true, inputMode: "numeric", hint: "Empty = unlimited", defaultValue: coupon?.max_redemptions != null ? String(coupon.max_redemptions) : "" },
        { kind: "text", name: "per_user_limit", label: "Max uses per customer", half: true, inputMode: "numeric", hint: "Empty = unlimited", defaultValue: coupon?.per_user_limit != null ? String(coupon.per_user_limit) : coupon ? "" : "1" },
        { kind: "check", name: "is_active", label: "Active", half: true, defaultValue: on(coupon?.is_active, true) },
        { kind: "datetime", name: "starts_at", label: "Starts (optional)", half: true, defaultValue: coupon?.starts_at ?? "" },
        { kind: "datetime", name: "ends_at", label: "Ends (optional)", half: true, defaultValue: coupon?.ends_at ?? "" },
      ]}
      onSubmit={(v) =>
        saveCoupon({
          id: coupon?.id ?? "",
          code: v.code ?? "",
          type: v.type as "percent",
          value: v.value ?? "",
          applies_product: (v.applies_product ?? "") as "" | "rdp" | "vps",
          min_order: v.min_order ?? "",
          max_redemptions: v.max_redemptions ?? "",
          per_user_limit: v.per_user_limit ?? "",
          starts_at: v.starts_at ?? "",
          ends_at: v.ends_at ?? "",
          is_active: v.is_active === "on",
        })
      }
    />
  );
}

// ---------------------------------------------------------------------------
// FAQs
// ---------------------------------------------------------------------------
export function FaqEditor({ faq, categories }: { faq?: Faq; categories: string[] }) {
  return (
    <ActionDialog
      size="lg"
      trigger={faq ? edit : <Button size="sm">New FAQ</Button>}
      title={faq ? "Edit FAQ" : "New FAQ"}
      description="Answers support Markdown: **bold**, lists and [links](https://…)."
      confirmLabel="Save FAQ"
      fields={[
        { kind: "text", name: "question", label: "Question", required: true, defaultValue: faq?.question ?? "" },
        { kind: "textarea", name: "answer_md", label: "Answer", required: true, defaultValue: faq?.answer_md ?? "" },
        { kind: "text", name: "category", label: "Category", half: true, hint: categories.length ? `In use: ${categories.join(", ")}` : "e.g. ordering", defaultValue: faq?.category ?? categories[0] ?? "ordering" },
        { kind: "text", name: "sort_order", label: "Order within category", half: true, inputMode: "numeric", defaultValue: String(faq?.sort_order ?? 0) },
        { kind: "text", name: "slug", label: "Address (optional)", half: true, hint: "Made from the question if empty.", defaultValue: faq?.slug ?? "" },
        { kind: "check", name: "is_published", label: "Published", half: true, defaultValue: on(faq?.is_published, true) },
      ]}
      onSubmit={(v) =>
        saveFaq({
          id: faq?.id ?? "",
          category: v.category ?? "",
          question: v.question ?? "",
          answer_md: v.answer_md ?? "",
          slug: v.slug ?? "",
          sort_order: v.sort_order,
          is_published: v.is_published === "on",
        })
      }
    />
  );
}

export function DeleteFaq({ id, question }: { id: string; question: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="ghost">
          Delete
        </Button>
      }
      title="Delete this FAQ?"
      description={<>“{question}” will be removed from the site. This can&apos;t be undone — switch it to unpublished instead if you may want it back.</>}
      confirmLabel="Delete FAQ"
      onConfirm={() => deleteFaq({ id })}
    />
  );
}

// ---------------------------------------------------------------------------
// Saved replies
// ---------------------------------------------------------------------------
export function CannedEditor({ reply }: { reply?: { id: string; title: string; body_md: string } }) {
  return (
    <ActionDialog
      trigger={reply ? edit : <Button size="sm">New saved reply</Button>}
      title={reply ? "Edit saved reply" : "New saved reply"}
      description="Saved replies are inserted into a ticket reply, where you can edit them before sending."
      confirmLabel="Save reply"
      fields={[
        { kind: "text", name: "title", label: "Title", required: true, defaultValue: reply?.title ?? "" },
        { kind: "textarea", name: "body_md", label: "Reply", required: true, defaultValue: reply?.body_md ?? "" },
      ]}
      onSubmit={(v) => saveCannedResponse({ id: reply?.id ?? "", title: v.title ?? "", body_md: v.body_md ?? "" })}
    />
  );
}

export function DeleteCanned({ id, title }: { id: string; title: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="ghost">
          Delete
        </Button>
      }
      title={`Delete “${title}”?`}
      description="The saved reply is removed for everyone on the team."
      confirmLabel="Delete reply"
      onConfirm={() => deleteCannedResponse({ id })}
    />
  );
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------
export function AddStaff() {
  return (
    <ActionDialog
      trigger={<Button size="sm">Add team member</Button>}
      title="Add a team member"
      description="Enter their email. If they already have an account they get the role straight away; otherwise they are invited by email."
      confirmLabel="Add"
      fields={[
        { kind: "text", name: "email", label: "Email address", required: true },
        { kind: "select", name: "role", label: "Role", required: true, defaultValue: "support", options: [{ value: "support", label: "Support — tickets, read-only orders" }, { value: "admin", label: "Admin — everything" }] },
      ]}
      onSubmit={(v) => addStaff({ email: v.email ?? "", role: (v.role || "support") as "support" })}
    />
  );
}

export function StaffRow({ id, name, role, active, isMe }: { id: string; name: string; role: "support" | "admin"; active: boolean; isMe: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`role-${id}`}>
        Role for {name}
      </label>
      <select
        id={`role-${id}`}
        defaultValue={role}
        disabled={pending || isMe}
        title={isMe ? "You can't change your own role" : undefined}
        onChange={(e) =>
          start(async () => {
            setError(null);
            const r = await setStaffRole({ userId: id, role: e.target.value as "support" });
            if (!r.ok) setError(r.message);
          })
        }
        className="h-10 rounded-card border border-black/[0.08] bg-surface px-3 text-[14px] text-ink outline-none hover:border-line-2 focus:border-lav-600 disabled:opacity-60"
      >
        <option value="support">Support</option>
        <option value="admin">Admin</option>
        <option value="customer">Remove access</option>
      </select>
      {!isMe &&
        (active ? (
          <ActionDialog
            trigger={
              <Button size="sm" variant="ghost">
                Deactivate
              </Button>
            }
            title={`Deactivate ${name}?`}
            description="They lose console access immediately and can't sign in to the dashboard until you restore the account."
            confirmLabel="Deactivate"
            danger
            fields={[{ kind: "select", name: "reason", label: "Reason", required: true, options: ["Customer request", "Security concern", "Other"] }]}
            onSubmit={(v) => setStaffActive({ userId: id, active: false, reason: v.reason as "Other" })}
          />
        ) : (
          <Button
            size="sm"
            variant="secondary"
            loading={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await setStaffActive({ userId: id, active: true });
                if (!r.ok) setError(r.message);
              })
            }
          >
            Restore
          </Button>
        ))}
      {error && <span className="field-error !mt-0">{error}</span>}
    </div>
  );
}
