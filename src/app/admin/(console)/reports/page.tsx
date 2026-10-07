import type { Metadata } from "next";
import { LifeBuoy, MessageSquareReply, Receipt, ShoppingCart, Tag, Undo2, UserPlus, Wallet } from "lucide-react";
import { AdminHeader, GroupHeading } from "@/components/admin/parts";
import { BarList } from "@/components/admin/charts";
import { Figure, LedgerSection } from "@/components/ledger/primitives";
import { FilterLinks, param, withParams } from "@/components/portal/list-controls";
import { requireAdminConsole } from "@/lib/admin/guard";
import { percentChange } from "@/lib/admin/money";
import { isRange, RANGES, rangeBounds, type RangeKey } from "@/lib/admin/queries";
import { getReportData } from "@/lib/admin/queries-system";
import { buildReport, type Row } from "@/lib/admin/reports";
import { now } from "@/lib/clock";
import { formatUsd } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

function MoneyTable({ rows, label }: { rows: Row[]; label: string }) {
  if (rows.length === 0) return <p className="px-6 py-10 text-center text-[14px] text-muted">Nothing in this range.</p>;
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={label}>
      <table className="w-full min-w-[320px] border-collapse text-left text-[13.5px]">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr className="border-b border-line bg-surface-2/60">
            <th scope="col" className="label-caps h-10 pl-6 pr-3 font-medium">{label}</th>
            <th scope="col" className="label-caps h-10 px-3 text-right font-medium">Invoices</th>
            <th scope="col" className="label-caps h-10 pl-3 pr-6 text-right font-medium">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-line last:border-b-0 hover:bg-surface-2/70">
              <th scope="row" className="py-3 pl-6 pr-3 text-left font-medium text-ink">{r.label}</th>
              <td className="num-tabular px-3 py-3 text-right">{r.count}</td>
              <td className="num-tabular py-3 pl-3 pr-6 text-right font-medium text-ink">{formatUsd(r.cents, { cents: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminConsole();
  const sp = await searchParams;
  const requested = param(sp.range);
  const range: RangeKey = isRange(requested) ? requested : "30d";
  const b = rangeBounds(range, now());

  const [cur, prev] = await Promise.all([getReportData(b.from, b.to), getReportData(b.prevFrom, b.prevTo)]);
  const r = buildReport(cur);
  const p = buildReport(prev);

  return (
    <>
      <AdminHeader
        title="Reports"
        description="Revenue counts paid invoices. Every table can be exported; exports are recorded in the audit log."
        actions={
          <div className="flex flex-wrap gap-2">
            <a href={`/admin/reports/export?kind=orders&range=${range}`} className="btn btn-secondary btn-sm">Export orders</a>
            <a href={`/admin/reports/export?kind=invoices&range=${range}`} className="btn btn-secondary btn-sm">Export invoices</a>
          </div>
        }
      />
      <FilterLinks label="Date range" current={range} hrefFor={(id) => withParams("/admin/reports", { range: id === "30d" ? null : id })} items={RANGES} />

      <section aria-labelledby="revenue-heading">
        <GroupHeading title={<span id="revenue-heading">Revenue</span>} aside="vs the previous period" />
        <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          <Figure icon={Wallet} label="Gross" value={formatUsd(r.grossCents)} delta={percentChange(r.grossCents, p.grossCents)} note="before discounts" />
          <Figure icon={Tag} label="Discounts" value={formatUsd(r.discountCents)} note="coupons applied" />
          <Figure icon={Undo2} label="Refunds" value={formatUsd(r.refundCents)} note="recorded" />
          <Figure icon={Receipt} label="Net" value={formatUsd(r.netCents)} delta={percentChange(r.netCents, p.netCents)} note={`${r.paidInvoices} paid invoices`} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <LedgerSection flush title="By product"><MoneyTable rows={r.byProduct} label="Product" /></LedgerSection>
        <LedgerSection flush title="New vs renewal"><MoneyTable rows={r.newVsRenewal} label="Type" /></LedgerSection>
        <LedgerSection flush title="By plan"><MoneyTable rows={r.byPlan} label="Plan" /></LedgerSection>
        <LedgerSection flush title="By location"><MoneyTable rows={r.byLocation} label="Location" /></LedgerSection>
        <LedgerSection flush title="By payment method"><MoneyTable rows={r.byMethod} label="Method" /></LedgerSection>
        <LedgerSection title="Order funnel">
          <BarList items={r.funnel.map((f) => ({ label: f.label, count: f.count }))} />
        </LedgerSection>
      </div>

      <section aria-labelledby="customers-heading">
        <GroupHeading title={<span id="customers-heading">Customers &amp; support</span>} />
        <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          <Figure icon={UserPlus} label="New customers" value={r.newCustomers} delta={percentChange(r.newCustomers, p.newCustomers)} />
          <Figure icon={LifeBuoy} label="Tickets opened" value={r.tickets.opened} delta={percentChange(r.tickets.opened, p.tickets.opened)} />
          <Figure icon={MessageSquareReply} label="Answered by staff" value={r.tickets.opened ? `${Math.round((r.tickets.answered / r.tickets.opened) * 100)}%` : "—"} note="of tickets opened" />
          <Figure icon={ShoppingCart} label="Orders placed" value={cur.orders.length} delta={percentChange(cur.orders.length, prev.orders.length)} />
        </div>
      </section>
    </>
  );
}
