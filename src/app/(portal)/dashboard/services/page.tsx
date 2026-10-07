import { Search } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/portal/empty-state";
import { FilterLinks, Pagination, pageParam, param, withParams } from "@/components/portal/list-controls";
import { PageHeader } from "@/components/portal/page-header";
import { ServiceRow } from "@/components/portal/service-row";
import { Button, ButtonLink } from "@/components/ui/button";
import { getCatalog } from "@/lib/catalog";
import { listServices, type ServiceFilter } from "@/lib/portal/queries";

export const metadata: Metadata = { title: "Services" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const FILTERS: ServiceFilter[] = ["all", "active", "expiring", "suspended", "expired"];
const LABELS: Record<ServiceFilter, string> = {
  all: "All",
  active: "Active",
  expiring: "Expiring soon",
  suspended: "Suspended",
  expired: "Expired",
};

export default async function ServicesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const filter = (FILTERS.find((f) => f === param(sp.filter)) ?? "all") as ServiceFilter;
  const q = param(sp.q)?.slice(0, 80) ?? "";
  const page = pageParam(sp.page);

  const [result, catalog] = await Promise.all([listServices({ filter, q, page }), getCatalog()]);
  const locationById = new Map(catalog.locations.map((l) => [l.id, l]));
  const base = "/dashboard/services";
  const keep = { q: q || null };

  return (
    <>
      <PageHeader
        title="Services"
        description="Your Windows RDP and VPS servers, soonest-expiring first."
        actions={<ButtonLink href="/order/new">New order</ButtonLink>}
      />

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 flex-1">
          <FilterLinks
            label="Filter servers"
            current={filter}
            items={FILTERS.map((id) => ({ id, label: LABELS[id], count: result.counts[id] }))}
            hrefFor={(id) => withParams(base, { filter: id === "all" ? null : id, ...keep })}
          />
        </div>
        <form method="get" action={base} role="search" className="flex items-center gap-2 pb-2">
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <label htmlFor="service-search" className="sr-only">
            Search servers by name or IP
          </label>
          <div className="relative">
            <Search size={16} strokeWidth={1.5} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="service-search"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Search name or IP"
              autoComplete="off"
              className="field-input !h-10 !w-[220px] !pl-9 !text-[14px]"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
      </div>

      {result.counts.all === 0 ? (
        <EmptyState
          image="empty-services"
          title="No servers yet"
          body="Your servers appear here once an order is paid and delivered."
          action={<ButtonLink href="/order/new">Order your first server</ButtonLink>}
        />
      ) : result.total === 0 ? (
        <EmptyState
          image="empty-search"
          title="No servers match"
          body="Try a different filter or search term."
          action={
            <ButtonLink href={base} variant="secondary">
              Clear filters
            </ButtonLink>
          }
        />
      ) : (
        <>
          <p role="status" className="sr-only">
            {result.total} {result.total === 1 ? "server" : "servers"}
          </p>
          <ul>
            {result.items.map(({ service, state }) => (
              <ServiceRow key={service.id} service={service} state={state} location={locationById.get(service.location_id)} />
            ))}
          </ul>
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            hrefFor={(p) => withParams(base, { filter: filter === "all" ? null : filter, ...keep, page: p })}
          />
        </>
      )}
    </>
  );
}
