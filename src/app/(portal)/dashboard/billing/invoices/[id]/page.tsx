import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceDocument } from "@/components/portal/invoice-document";
import { PrintButton } from "@/components/portal/print-button";
import { publicEnv } from "@/lib/env";
import { buildInvoiceView } from "@/lib/invoice";
import { getInvoice } from "@/lib/portal/queries";
import { getSiteSettings } from "@/lib/site-settings";

export const metadata: Metadata = { title: "Invoice" };

type Props = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The company block saved on the invoice when it was issued: a string, or an object of lines. */
function companyLines(block: unknown): string[] {
  const lines = typeof block === "string" ? block.split("\n") : block && typeof block === "object" ? Object.values(block) : [];
  return lines.filter((l): l is string => typeof l === "string" && l.trim() !== "").map((l) => l.trim());
}

/** A printable invoice. The customer and the company details are the ones from the day it was issued. */
export default async function InvoicePage({ params }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const data = await getInvoice(id);
  if (!data) notFound();

  const view = buildInvoiceView({ order: data.order, invoice: data.invoice, payment: data.payment ?? null, billTo: null });
  if (!view) notFound();
  const site = await getSiteSettings();
  const snapshot = (data.invoice.billing_snapshot ?? {}) as Record<string, unknown>;

  return (
    <>
      <div className="mx-auto mb-8 flex max-w-[820px] items-center justify-between gap-4 print:hidden">
        <Link href="/dashboard/billing" className="text-link text-[14px]">
          ← Back to billing
        </Link>
        <PrintButton label="Print or save as PDF" />
      </div>
      <InvoiceDocument
        view={view}
        seller={{ name: site.name, lines: companyLines(snapshot.company_block), email: site.supportEmail, host: new URL(publicEnv.siteUrl).host }}
      />
    </>
  );
}
