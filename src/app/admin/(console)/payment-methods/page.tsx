import type { Metadata } from "next";
import { AdminHeader, Ago } from "@/components/admin/parts";
import { DataTable, type Column } from "@/components/admin/data-table";
import { MethodActiveToggle, MethodEditor } from "@/components/admin/editors";
import { QrUpload } from "@/components/admin/qr-upload";
import { PaymentLogo } from "@/components/shared/payment-logo";
import { requireAdminConsole } from "@/lib/admin/guard";
import { getPaymentMethodsAdmin } from "@/lib/admin/queries-system";
import { now } from "@/lib/clock";
import { formatUsd } from "@/lib/utils";

export const metadata: Metadata = { title: "Payment methods" };

type Row = Awaited<ReturnType<typeof getPaymentMethodsAdmin>>[number];
const TYPE: Record<string, string> = { bank: "Bank transfer", mobile_wallet: "Mobile wallet", upi: "UPI", crypto: "Crypto", other: "Other" };

export default async function PaymentMethodsPage() {
  await requireAdminConsole();
  const nowMs = now();
  const rows = await getPaymentMethodsAdmin(nowMs);
  const inactiveWithoutDetails = rows.filter((r) => r.method.is_active && (!Array.isArray(r.method.details) || r.method.details.length === 0));

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Method",
      cell: ({ method: m }) => (
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-7 w-10 shrink-0 items-center justify-center">
            <PaymentLogo name={m.name} type={m.type} className="max-w-full object-contain" />
          </span>
          <span className="block min-w-0">
            <span className="block font-semibold text-ink">{m.name}</span>
            <span className="block text-[12px] text-muted">
              {TYPE[m.type] ?? m.type} · {m.regions.length ? m.regions.map((r) => r.trim()).join(", ") : "Everywhere"}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: "rate",
      header: "Rate",
      hide: "md",
      cell: ({ method: m }) =>
        m.currency_code && m.rate_per_usd ? (
          <span className="num-tabular">
            1 USD = {m.rate_per_usd} {m.currency_code.trim()}
            {m.rate_updated_at && (
              <span className="block text-[12px] text-muted">
                updated <Ago value={m.rate_updated_at} nowMs={nowMs} />
              </span>
            )}
          </span>
        ) : (
          <span className="text-muted">USD</span>
        ),
    },
    {
      key: "details",
      header: "Account details",
      hide: "lg",
      cell: ({ method: m }) => <span className="num-tabular text-ink-2">{Array.isArray(m.details) ? m.details.length : 0} line{Array.isArray(m.details) && m.details.length === 1 ? "" : "s"}</span>,
    },
    {
      key: "usage",
      header: "Last 30 days",
      align: "right",
      hide: "md",
      cell: ({ usage }) => (
        <span className="num-tabular">
          {usage.count} · {formatUsd(usage.cents)}
        </span>
      ),
    },
    { key: "qr", header: "QR code", hide: "xl", cell: ({ method: m }) => <QrUpload id={m.id} hasQr={Boolean(m.qr_path)} /> },
    { key: "active", header: "Available", cell: ({ method: m }) => <MethodActiveToggle id={m.id} name={m.name} active={m.is_active} /> },
    { key: "edit", header: "Edit", srOnlyHeader: true, align: "right", cell: ({ method: m }) => <MethodEditor method={m} /> },
  ];

  return (
    <>
      <AdminHeader
        title="Payment methods"
        description="Where customers send money. A method is only shown to customers while it is switched on — fill in its real account details first."
        actions={<MethodEditor />}
      />
      {inactiveWithoutDetails.length > 0 && (
        <p role="alert" className="form-note mb-6" data-tone="error">
          {inactiveWithoutDetails.map((r) => r.method.name).join(", ")} {inactiveWithoutDetails.length === 1 ? "is" : "are"} switched on but {inactiveWithoutDetails.length === 1 ? "has" : "have"} no account details, so customers can&apos;t pay with {inactiveWithoutDetails.length === 1 ? "it" : "them"}.
        </p>
      )}
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.method.id} label="Payment methods" empty="No payment methods." />
      <p className="mt-6 max-w-[70ch] text-[13px] text-muted">
        Customers pay in the currency shown, calculated from the rate above and locked when they place the order. Update a rate with Edit — the “updated” time moves only when the rate itself changes.
      </p>
    </>
  );
}
