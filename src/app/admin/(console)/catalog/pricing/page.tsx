import type { Metadata } from "next";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/parts";
import { PricingMatrix } from "@/components/admin/pricing-matrix";
import { requireAdminConsole } from "@/lib/admin/guard";
import { getCatalogAdmin } from "@/lib/admin/queries-system";

export const metadata: Metadata = { title: "Pricing & stock" };

export default async function PricingPage() {
  await requireAdminConsole();
  const { plans, locations, pricing } = await getCatalogAdmin();
  // The grid keeps its edits in the browser; a new key (the newest update time) starts it from the saved data after a save.
  const version = `${pricing.length}:${pricing.reduce((m, p) => (p.updated_at > m ? p.updated_at : m), "")}`;

  return (
    <>
      <AdminHeader title="Pricing & stock" description="Price (USD, per 30-day term), stock state and availability for every plan in every location. Edits go live on the public site when you save." />
      {plans.length === 0 || locations.length === 0 ? (
        <p className="border-y border-line py-12 text-center text-[14px] text-muted">
          Add at least one <Link href="/admin/catalog/plans" className="text-link">plan</Link> and one <Link href="/admin/catalog/locations" className="text-link">location</Link> first.
        </p>
      ) : (
        <PricingMatrix key={version} plans={plans} locations={locations} pricing={pricing} />
      )}
    </>
  );
}
