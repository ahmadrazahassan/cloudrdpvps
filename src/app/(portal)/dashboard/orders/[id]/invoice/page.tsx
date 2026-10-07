import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { InvoiceDocument } from "@/components/portal/invoice-document";
import { PrintButton } from "@/components/portal/print-button";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { buildInvoiceView } from "@/lib/invoice";
import { getBillTo, getOrder, listPaymentMethods } from "@/lib/portal/queries";
import { getSiteSettings } from "@/lib/site-settings";

export const metadata: Metadata = { title: "Proforma invoice" };

type Props = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The invoice for an order that hasn't been paid yet: a proforma, numbered by the order. Once the payment
 * is verified the real invoice exists and this address sends you to it, so one link works for the order's whole life.
 */
export default async function OrderInvoicePage({ params }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  await requireUser(`/dashboard/orders/${id}/invoice`);

  const data = await getOrder(id);
  if (!data) notFound();
  if (data.invoice) redirect(`/dashboard/billing/invoices/${data.invoice.id}`);

  const { order, payments } = data;
  const [site, billTo] = await Promise.all([getSiteSettings(), getBillTo(order.user_id)]);
  const view = buildInvoiceView({ order, invoice: null, payment: payments[0] ?? null, billTo });
  if (!view) notFound();

  const unpaid = view.status === "unpaid";
  const methods = unpaid ? (await listPaymentMethods()).map((m) => ({ id: m.id, name: m.name, type: m.type })) : [];

  return (
    <>
      <div className="mx-auto mb-8 flex max-w-[820px] flex-wrap items-center justify-between gap-4 print:hidden">
        <Link href={`/dashboard/orders/${order.id}`} className="text-link text-[14px]">
          ← Back to order
        </Link>
        <div className="flex items-center gap-3">
          <PrintButton label="Print or save as PDF" />
          {unpaid && <ButtonLink href={`/dashboard/orders/${order.id}/pay`}>Pay this invoice</ButtonLink>}
        </div>
      </div>
      <InvoiceDocument
        view={view}
        seller={{ name: site.name, lines: [], email: site.supportEmail, host: new URL(publicEnv.siteUrl).host }}
        methods={methods}
      />
    </>
  );
}
