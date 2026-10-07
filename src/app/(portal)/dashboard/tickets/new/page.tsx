import type { Metadata } from "next";
import { NewTicketForm } from "@/components/portal/new-ticket-form";
import { PageHeader } from "@/components/portal/page-header";
import { param } from "@/components/portal/list-controls";
import { listServiceOptions } from "@/lib/portal/queries";

export const metadata: Metadata = { title: "New ticket" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NewTicketPage({ searchParams }: Props) {
  const sp = await searchParams;
  const services = await listServiceOptions();
  const service = param(sp.service);
  const defaultServiceId = service && UUID.test(service) && services.some((s) => s.id === service) ? service : undefined;

  return (
    <>
      <PageHeader
        title="New ticket"
        description="Tell us what's happening. Restarts and reinstalls are done by our team — just ask."
      />
      <NewTicketForm services={services} defaultServiceId={defaultServiceId} defaultCategory={param(sp.category)} />
    </>
  );
}
