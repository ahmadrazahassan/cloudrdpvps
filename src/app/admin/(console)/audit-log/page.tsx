import type { Metadata } from "next";
import Link from "next/link";
import { Ago, AdminHeader, FilterBar, ResultCount } from "@/components/admin/parts";
import { FIELD } from "@/components/admin/field-class";
import { LedgerSection } from "@/components/ledger/primitives";
import { JsonDiff } from "@/components/admin/json-diff";
import { Pagination, pageParam, param, withParams } from "@/components/portal/list-controls";
import { requireAdminConsole } from "@/lib/admin/guard";
import { displayName } from "@/lib/admin/db";
import { getAuditFilterOptions, getAuditLog } from "@/lib/admin/queries-system";
import { now } from "@/lib/clock";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit log" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const ENTITY_LINK: Record<string, string> = { order: "/admin/orders/", service: "/admin/services/", payment: "/admin/payments?tab=all&p=", profile: "/admin/customers/", invoice: "/admin/invoices" };

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminConsole();
  const sp = await searchParams;
  const action = param(sp.action)?.slice(0, 60);
  const entity = param(sp.entity)?.slice(0, 40);
  const actorParam = param(sp.actor);
  const actor = actorParam && UUID.test(actorParam) ? actorParam : undefined;
  const fromParam = param(sp.from);
  const toParam = param(sp.to);
  const from = fromParam && DATE.test(fromParam) ? fromParam : undefined;
  const to = toParam && DATE.test(toParam) ? toParam : undefined;
  const page = pageParam(sp.page);
  const nowMs = now();

  const [data, options] = await Promise.all([
    getAuditLog({ action, entity, actor, from: from ? `${from}T00:00:00Z` : undefined, to: to ? new Date(Date.parse(`${to}T00:00:00Z`) + 86_400_000).toISOString() : undefined, page }),
    getAuditFilterOptions(),
  ]);

  const keep = { action, entity, actor, from, to };
  const exportHref = withParams("/admin/audit-log/export", keep);
  const entities = ["order", "payment", "service", "profile", "invoice", "plans", "plan_pricing", "locations", "payment_methods", "coupons", "site_settings", "faqs", "inventory_items"];

  return (
    <>
      <AdminHeader
        title="Audit log"
        description="Every change made in the console, with who did it and what changed. It can't be edited or deleted from here."
        actions={
          <a href={exportHref} className="btn btn-secondary btn-sm">
            Export CSV
          </a>
        }
      />
      <FilterBar
        action="/admin/audit-log"
        q=""
        placeholder="Search is by filter →"
        selects={[
          { name: "action", label: "Action", all: "Any action", value: action, options: options.actions.map((a) => ({ value: a, label: a })) },
          { name: "entity", label: "Record type", all: "Any record", value: entity, options: entities.map((e) => ({ value: e, label: e.replace(/_/g, " ") })) },
          { name: "actor", label: "Person", all: "Anyone", value: actor, options: options.staff.map((s) => ({ value: s.id, label: s.full_name.trim() || s.email })) },
        ]}
      >
        <label className="sr-only" htmlFor="audit-from">From date</label>
        <input id="audit-from" type="date" name="from" defaultValue={from ?? ""} className={FIELD} />
        <label className="sr-only" htmlFor="audit-to">To date</label>
        <input id="audit-to" type="date" name="to" defaultValue={to ?? ""} className={FIELD} />
      </FilterBar>

      <div className="flex justify-end">
        <ResultCount total={data.total} noun="event" />
      </div>

      <LedgerSection flush title="Events">
        {data.items.length === 0 ? (
          <p className="px-6 py-12 text-center text-[14px] text-muted">No events match.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.items.map(({ event: e, actor: who }) => {
              const link = e.entity_type && e.entity_id && ENTITY_LINK[e.entity_type] ? (e.entity_type === "invoice" ? ENTITY_LINK.invoice : `${ENTITY_LINK[e.entity_type]}${e.entity_id}`) : null;
              return (
                <li key={e.id}>
                  <details className="group">
                    <summary className="ledger-row flex cursor-pointer list-none flex-wrap items-baseline gap-x-4 gap-y-1 px-6 py-3.5 text-[13.5px] [&::-webkit-details-marker]:hidden">
                      <span className="data-id min-w-[190px] font-semibold text-ink">{e.action}</span>
                      <span className="min-w-[140px] text-ink-2">{who ? displayName(who) : e.actor_id ? "Unknown" : "System"}</span>
                      <span className="min-w-0 flex-1 truncate text-muted">
                        {e.entity_type}
                        {e.reason ? ` — ${e.reason}` : ""}
                      </span>
                      <time dateTime={e.created_at} title={`${formatDateTime(e.created_at)} UTC`} className="text-[12.5px] text-muted">
                        <Ago value={e.created_at} nowMs={nowMs} />
                      </time>
                    </summary>
                    <div className="space-y-4 px-6 pb-5">
                      <dl className="grid gap-x-8 gap-y-1 text-[13px] sm:grid-cols-2">
                        <div className="flex gap-3"><dt className="text-muted">When</dt><dd className="text-ink">{formatDateTime(e.created_at)} UTC</dd></div>
                        <div className="flex gap-3"><dt className="text-muted">Role</dt><dd className="text-ink capitalize">{e.actor_role ?? "—"}</dd></div>
                        <div className="flex gap-3"><dt className="text-muted">IP</dt><dd className="data-id text-ink">{e.ip ? String(e.ip).split("/")[0] : "—"}</dd></div>
                        <div className="flex min-w-0 gap-3"><dt className="shrink-0 text-muted">Browser</dt><dd className="truncate text-ink">{e.user_agent ?? "—"}</dd></div>
                        {e.entity_id && (
                          <div className="flex gap-3"><dt className="text-muted">Record</dt><dd className="data-id break-all text-ink">{link ? <Link href={link} className="text-link">{e.entity_id}</Link> : e.entity_id}</dd></div>
                        )}
                      </dl>
                      <JsonDiff before={e.before} after={e.after} />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </LedgerSection>
      <Pagination page={data.page} pageCount={data.pageCount} hrefFor={(n) => withParams("/admin/audit-log", { ...keep, page: n })} />
    </>
  );
}
