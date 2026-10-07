import type { Metadata } from "next";
import { AdminHeader, Ago } from "@/components/admin/parts";
import { DataTable, type Column } from "@/components/admin/data-table";
import { CouponEditor } from "@/components/admin/editors";
import { AdminBadge } from "@/components/admin/status";
import { requireAdminConsole } from "@/lib/admin/guard";
import { getCouponsAdmin, type Coupon } from "@/lib/admin/queries-system";
import { now } from "@/lib/clock";
import { formatDate } from "@/lib/format";
import { formatUsd } from "@/lib/utils";

export const metadata: Metadata = { title: "Coupons" };

export default async function CouponsPage() {
  await requireAdminConsole();
  const nowMs = now();
  const coupons = await getCouponsAdmin();

  const state = (c: Coupon) => {
    if (!c.is_active) return "suspended";
    if (c.ends_at && Date.parse(c.ends_at) < nowMs) return "suspended";
    if (c.max_redemptions != null && c.redeemed_count >= c.max_redemptions) return "suspended";
    return "active";
  };

  const columns: Column<Coupon>[] = [
    { key: "code", header: "Code", cell: (c) => <span className="data-id font-semibold text-ink">{c.code}</span> },
    { key: "value", header: "Discount", cell: (c) => <span className="num-tabular">{c.type === "percent" ? `${c.value}% off` : `${formatUsd(c.value, { cents: true })} off`}</span> },
    { key: "applies", header: "Applies to", hide: "md", cell: (c) => <span className="text-ink-2">{c.applies_product ? c.applies_product.toUpperCase() : "Everything"}{c.min_order_cents > 0 && <span className="block text-[12px] text-muted">min {formatUsd(c.min_order_cents, { cents: true })}</span>}</span> },
    { key: "uses", header: "Used", align: "right", cell: (c) => <span className="num-tabular">{c.redeemed_count}{c.max_redemptions != null ? ` / ${c.max_redemptions}` : ""}</span> },
    { key: "window", header: "Valid", hide: "lg", cell: (c) => <span className="text-ink-2">{c.starts_at ? formatDate(c.starts_at) : "Now"} → {c.ends_at ? formatDate(c.ends_at) : "no end"}</span> },
    { key: "state", header: "Status", cell: (c) => <AdminBadge kind="account" status={state(c)} /> },
    { key: "created", header: "Created", hide: "xl", cell: (c) => <Ago value={c.created_at} nowMs={nowMs} className="text-muted" /> },
    { key: "edit", header: "Edit", srOnlyHeader: true, align: "right", cell: (c) => <CouponEditor coupon={c} /> },
  ];

  return (
    <>
      <AdminHeader title="Coupons" description="Discount codes customers enter at checkout. Codes aren't case-sensitive. A coupon can never make an order free." actions={<CouponEditor />} />
      <DataTable rows={coupons} columns={columns} rowKey={(c) => c.id} label="Coupons" empty="No coupons yet." />
    </>
  );
}
