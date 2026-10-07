import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/parts";
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
  if (rows.length === 0) return <p className="border-y border-line py-6 text-center text-[14px] text-muted">Nothing in this range.</p>;
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={label}>
      <table className="w-full min-w-[360px] border-collapse text-left text-[13.5px]">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr className="border-b border-line-2">
            <th scope="col" className="label-caps h-9 pr-3 font-medium">{label}</th>
            <th scope="col" className="label-caps h-9 px-3 text-right font-medium">Invoices</th>
            <th scope="col" className="label-caps h-9 pl-3 text-right font-medium">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-line">
              <th scope="row" className="py-2 pr-3 text-left font-medium text-ink">{r.label}</th>
              <td className="num-tabular px-3 py-2 text-right">{r.count}</td>
              <td className="num-tabular py-2 pl-3 text-right font-medium text-ink">{formatUsd(r.cents, { cents: true })}</td>
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
  let n = 0;

  return (
    <>
      <AdminHeader
        title="Reports"
        description="Revenue counts paid invoices. Every table can be exported; exports are recorded in the audit log."
        actions={
          <>
            <a href={`/admin/reports/export?kind=orders&range=${range}`} className="btn btn-secondary btn-sm">Export orders</a>
            <a href={`/admin/reports/export?kind=invoices&range=${range}`} className="btn btn-secondary btn-sm">Export invoices</a>
          </>
        }
      />
      <FilterLinks label="Date range" current={range} hrefFor={(id) => withParams("/admin/reports", { range: id === "30d" ? null : id })} items={RANGES} />

      <LedgerSection n={++n} title="Revenue" aside="vs the previous period" className="mt-8">
        <div className="grid grid-cols-2 divide-line border-y border-line lg:grid-cols-4 lg:divide-x [&>*]:border-b [&>*]:border-line lg:[&>*]:border-b-0">
          <Figure label="Gross" value={formatUsd(r.grossCents)} delta={percentChange(r.grossCents, p.grossCents)} note="before discounts" className="lg:first:pl-0" />
          <Figure label="Discounts" value={formatUsd(r.discountCents)} note="coupons applied" />
          <Figure label="Refunds" value={formatUsd(r.refundCents)} note="recorded" />
          <Figure label="Net" value={formatUsd(r.netCents)} delta={percentChange(r.netCents, p.netCents)} note={`${r.paidInvoices} paid invoices`} />
        </div>
      </LedgerSection>

      <div className="grid gap-x-12 lg:grid-cols-2">
        <LedgerSection n={++n} title="By product"><MoneyTable rows={r.byProduct} label="Product" /></LedgerSection>
        <LedgerSection n={++n} title="New vs renewal"><MoneyTable rows={r.newVsRenewal} label="Type" /></LedgerSection>
        <LedgerSection n={++n} title="By plan"><MoneyTable rows={r.byPlan} label="Plan" /></LedgerSection>
        <LedgerSection n={++n} title="By location"><MoneyTable rows={r.byLocation} label="Location" /></LedgerSection>
        <LedgerSection n={++n} title="By payment method"><MoneyTable rows={r.byMethod} label="Method" /></LedgerSection>
        <LedgerSection n={++n} title="Order funnel">
          <BarList items={r.funnel.map((f) => ({ label: f.label, count: f.count }))} />
        </LedgerSection>
      </div>

      <LedgerSection n={++n} title="Customers & support">
        <div className="grid grid-cols-2 divide-line border-y border-line lg:grid-cols-4 lg:divide-x [&>*]:border-b [&>*]:border-line lg:[&>*]:border-b-0">
          <Figure label="New customers" value={r.newCustomers} delta={percentChange(r.newCustomers, p.newCustomers)} className="lg:first:pl-0" />
          <Figure label="Tickets opened" value={r.tickets.opened} delta={percentChange(r.tickets.opened, p.tickets.opened)} />
          <Figure label="Answered by staff" value={r.tickets.opened ? `${Math.round((r.tickets.answered / r.tickets.opened) * 100)}%` : "—"} note="of tickets opened" />
          <Figure label="Orders placed" value={cur.orders.length} delta={percentChange(cur.orders.length, prev.orders.length)} />
        </div>
      </LedgerSection>
    </>
  );
}
