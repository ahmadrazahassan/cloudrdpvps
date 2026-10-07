import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Copy as DuplicateIcon } from "lucide-react";
import { Ago, AdminHeader, Mono } from "@/components/admin/parts";
import { AdminBadge } from "@/components/admin/status";
import { ProofViewer } from "@/components/admin/proof-viewer";
import { ReviewPanel } from "@/components/admin/review-panel";
import { Facts, Signal } from "@/components/ledger/primitives";
import { FilterLinks, Pagination, pageParam, param, withParams } from "@/components/portal/list-controls";
import { requireConsole } from "@/lib/admin/guard";
import { getPaymentDetail, isPaymentTab, listPaymentQueue, PAYMENT_TABS, type PaymentTab } from "@/lib/admin/queries";
import { displayName } from "@/lib/admin/db";
import { isAdmin } from "@/lib/auth/session";
import { now } from "@/lib/clock";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn, formatUsd } from "@/lib/utils";

export const metadata: Metadata = { title: "Payments" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** green under an hour, amber under four, red after that */
function age(ms: number): { tone: "ok" | "warn" | "bad"; label: string } {
  const h = ms / 3_600_000;
  return { tone: h < 1 ? "ok" : h < 4 ? "warn" : "bad", label: h < 1 ? `${Math.max(1, Math.round(ms / 60_000))}m` : h < 48 ? `${Math.round(h)}h` : `${Math.round(h / 24)}d` };
}

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireConsole();
  const admin = isAdmin(user);
  const sp = await searchParams;
  const tabParam = param(sp.tab);
  const tab: PaymentTab = isPaymentTab(tabParam) ? tabParam : "pending";
  const page = pageParam(sp.page);
  const wanted = param(sp.p);
  const nowMs = now();

  const queue = await listPaymentQueue(tab, page);
  const explicit = wanted && UUID.test(wanted) ? wanted : null;
  // On desktop the first row is open by default; on phones the list shows until a row is chosen.
  const selectedId = explicit ?? queue.items[0]?.payment.id ?? null;
  const detail = selectedId ? await getPaymentDetail(selectedId) : null;

  const hrefFor = (id: string | null, extra: Record<string, string | number | null> = {}) => withParams("/admin/payments", { tab: tab === "pending" ? null : tab, page: page > 1 ? page : null, p: id, ...extra });

  return (
    <>
      <AdminHeader
        title="Payments"
        description="Check each proof against your bank or wallet, then approve or reject. Oldest first."
      />
      <FilterLinks
        label="Payment status"
        current={tab}
        hrefFor={(id) => withParams("/admin/payments", { tab: id === "pending" ? null : id })}
        items={PAYMENT_TABS.map((t) => ({ id: t.id, label: t.label, count: queue.counts[t.id] }))}
      />

      <div className="mt-6 grid gap-x-10 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* Queue */}
        <section aria-label="Payment queue" className={cn("min-w-0", explicit && "hidden lg:block")}>
          {queue.items.length === 0 ? (
            <p className="border-y border-line py-14 text-center text-[14px] text-muted">
              {tab === "pending" ? "Nothing waiting for review. Nice." : "No payments here."}
            </p>
          ) : (
            <ul className="border-t border-line">
              {queue.items.map(({ payment, order, customer, duplicate }) => {
                const a = age(nowMs - Date.parse(payment.created_at));
                const active = payment.id === selectedId;
                return (
                  <li key={payment.id} className="ledger-row border-b border-line" data-active={active || undefined}>
                    <Link
                      href={hrefFor(payment.id)}
                      data-row-link
                      aria-current={active ? "true" : undefined}
                      className="flex items-center gap-3 py-3 pl-3 pr-1 outline-offset-[-2px]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                          <Mono>{order?.order_number ?? "—"}</Mono>
                          {duplicate && (
                            <span title="This proof file was used on another payment">
                              <DuplicateIcon size={14} strokeWidth={1.75} aria-hidden className="text-warn" />
                              <span className="sr-only">Possible duplicate</span>
                            </span>
                          )}
                        </p>
                        <p className="truncate text-[13px] text-ink-2">{displayName(customer)}</p>
                        <p className="truncate text-[12px] text-muted">{payment.method_name}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="num-tabular text-[14px] font-semibold text-ink">{formatUsd(payment.amount_usd_cents)}</p>
                        {payment.status === "pending" ? (
                          <p className="mt-1 flex items-center justify-end gap-1.5 text-[12px] text-muted">
                            <Signal tone={a.tone} pulse={a.tone === "bad"} />
                            <span className="num-tabular">{a.label}</span>
                            <span className="sr-only"> waiting</span>
                          </p>
                        ) : (
                          <div className="mt-1">
                            <AdminBadge kind="payment" status={payment.status} />
                          </div>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <Pagination page={queue.page} pageCount={queue.pageCount} hrefFor={(n) => hrefFor(null, { page: n })} />
        </section>

        {/* Detail */}
        <section aria-label="Payment detail" className={cn("min-w-0 lg:border-l lg:border-line lg:pl-10", !explicit && "hidden lg:block")}>
          {explicit && (
            <Link href={hrefFor(null, { p: null })} className="mb-5 inline-flex items-center gap-2 text-[14px] text-ink-2 hover:text-ink lg:hidden">
              <ArrowLeft size={16} strokeWidth={1.5} aria-hidden /> Back to the queue
            </Link>
          )}
          {!detail ? (
            <p className="py-14 text-center text-[14px] text-muted">{explicit ? "That payment couldn't be found." : "Choose a payment to review it."}</p>
          ) : (
            <PaymentDetail key={detail.payment.id} detail={detail} admin={admin} nowMs={nowMs} />
          )}
        </section>
      </div>
    </>
  );
}

function PaymentDetail({ detail, admin, nowMs }: { detail: NonNullable<Awaited<ReturnType<typeof getPaymentDetail>>>; admin: boolean; nowMs: number }) {
  const { payment, order, customer, method, duplicates, siblings, renewal } = detail;
  const pending = payment.status === "pending";
  const quoted =
    payment.quoted_amount && payment.quoted_currency
      ? `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(payment.quoted_amount)} ${payment.quoted_currency}${payment.quoted_rate ? ` @ ${payment.quoted_rate}` : ""}`
      : "Paid in USD";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[22px] font-semibold tracking-[-0.018em] text-ink">
          <Mono>{order?.order_number ?? "Payment"}</Mono>
        </h2>
        <AdminBadge kind="payment" status={payment.status} />
        {order && <AdminBadge kind="order" status={order.status} />}
        {order && (
          <Link href={`/admin/orders/${order.id}`} className="text-link ml-auto text-[14px]">
            Open order
          </Link>
        )}
      </div>

      {duplicates.length > 0 && (
        <div role="alert" className="form-note" data-tone="error">
          This proof matches {duplicates.length === 1 ? "another payment" : `${duplicates.length} other payments`}:{" "}
          {duplicates.map((d, i) => (
            <span key={d.id}>
              {i > 0 && ", "}
              <Link href={`/admin/orders/${d.order_id}`} className="font-semibold underline underline-offset-2">
                {d.order_number}
              </Link>{" "}
              ({d.status})
            </span>
          ))}
          . Check it isn&apos;t the same transfer used twice.
        </div>
      )}

      <ProofViewer src={`/admin/payments/${payment.id}/proof`} mime={payment.proof_mime} name={payment.reference || payment.id.slice(0, 8)} />

      <Facts
        items={[
          { label: "Customer", value: customer ? <Link href={`/admin/customers/${customer.id}`} className="hover:text-lav-700">{displayName(customer)}</Link> : "Unknown" },
          { label: "Plan", value: order ? `${order.plan_name} · ${order.location_name}` : "—" },
          { label: "Type", value: order ? (order.type === "renewal" ? "Renewal" : "New server") : "—" },
          { label: "Method", value: method?.name ?? payment.method_name },
          { label: "Expected (USD)", value: formatUsd(payment.amount_usd_cents, { cents: true }) },
          { label: "Expected (local)", value: quoted },
          { label: "Customer's reference", value: payment.reference ? <Mono>{payment.reference}</Mono> : <span className="font-normal text-muted">None given</span> },
          ...(payment.note ? [{ label: "Customer's note", value: payment.note }] : []),
          { label: "Submitted", value: <><Ago value={payment.created_at} nowMs={nowMs} /> <span className="font-normal text-muted">· {formatDateTime(payment.created_at)} UTC</span></> },
          { label: "File", value: <span className="data-id">{(payment.proof_mime ?? "file").replace("application/", "").replace("image/", "").toUpperCase()} · {payment.proof_size ? `${Math.round(payment.proof_size / 1024)} KB` : "—"} · {payment.proof_sha256.slice(0, 10)}…</span> },
          ...(payment.status !== "pending"
            ? [
                { label: payment.status === "verified" ? "Received" : "Rejected", value: payment.status === "verified" && payment.received_usd_cents != null ? formatUsd(payment.received_usd_cents, { cents: true }) : payment.reject_reason ?? "—" },
                ...(payment.reviewed_at ? [{ label: "Reviewed", value: formatDateTime(payment.reviewed_at) + " UTC" }] : []),
              ]
            : []),
        ]}
      />

      {renewal && (
        <p className="text-[14px] text-ink-2">
          <span className="font-semibold text-ink">Renewal preview.</span> Approving extends{" "}
          <Link href={`/admin/services/${renewal.service.id}`} className="text-link">{renewal.service.label}</Link> from {formatDate(renewal.from)} to{" "}
          <span className="font-semibold text-ink">{formatDate(renewal.to)}</span>.
        </p>
      )}

      {siblings.length > 0 && (
        <div>
          <p className="label-caps mb-2">Earlier attempts on this order</p>
          <ul className="divide-y divide-line border-y border-line text-[13.5px]">
            {siblings.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 py-2">
                <span className="text-muted">{formatDateTime(s.created_at)}</span>
                <span className="min-w-0 flex-1 truncate text-ink-2">{s.reject_reason ?? ""}</span>
                <AdminBadge kind="payment" status={s.status} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {pending && order && admin ? (
        <ReviewPanel paymentId={payment.id} orderNumber={order.order_number} orderType={order.type} expectedCents={payment.amount_usd_cents} />
      ) : pending ? (
        <p className="form-note">Only admins can approve or reject payments. You can read the proof and open the order.</p>
      ) : null}
    </div>
  );
}
