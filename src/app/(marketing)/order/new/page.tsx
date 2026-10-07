import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { OrderFlow, type RenewInfo, type SessionInfo } from "@/components/checkout/order-flow";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { getSessionUser } from "@/lib/auth/session";
import { getCatalog } from "@/lib/catalog";
import { isSupabaseConfigured } from "@/lib/env";
import { loginUrl } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Place an order",
  description: "Choose a Windows RDP or VPS plan and a country, then place your order.",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OrderPage({ searchParams }: Props) {
  const sp = await searchParams;
  const [catalog, user] = await Promise.all([getCatalog(), getSessionUser()]);

  // Who is ordering, as the order page needs to know: a signed-in customer is never asked to sign in again.
  const session: SessionInfo = !user
    ? { state: "guest" }
    : {
        state: !user.emailVerified ? "unverified" : user.profile.status === "suspended" ? "suspended" : "ready",
        name: user.profile.full_name.trim() || user.email.split("@")[0]!,
        email: user.email,
        billingCountry: user.profile.billing_country?.trim().toUpperCase() || null,
      };

  // Renewal mode: ?renew=<service id>. Only the owner can see the service (row-level security).
  let renew: RenewInfo | null = null;
  const renewId = first(sp.renew);
  if (renewId) {
    if (!user) redirect(loginUrl(`/order/new?renew=${encodeURIComponent(renewId)}`));
    if (!UUID.test(renewId)) notFound();

    const supabase = await createClient();
    const { data: service } = await supabase.from("services").select("*").eq("id", renewId).maybeSingle();
    if (!service) notFound();

    const location = catalog.locations.find((l) => l.id === service.location_id);
    const price = catalog.pricing.find((p) => p.planId === service.plan_id && p.locationId === service.location_id);
    renew = {
      serviceId: service.id,
      label: service.label,
      planId: service.plan_id,
      planName: service.plan_name,
      locationId: service.location_id,
      locationName: location?.name ?? "this location",
      iso2: location?.iso2 ?? "US",
      product: service.product,
      priceCents: price?.priceCents ?? null,
      expiresAt: service.expires_at,
      orderable:
        (service.status === "active" || service.status === "expired") &&
        catalog.plans.some((p) => p.id === service.plan_id) &&
        Boolean(location && price),
    };
  }

  // A link that names a plan and a country has nothing left to configure; one that names only a plan (the pricing cards) still needs the country.
  const fullChoice = Boolean(first(sp.plan) && first(sp.country));
  const needsCountry = Boolean(first(sp.plan) && !first(sp.country));

  return (
    <section className="pt-8 pb-28 md:pt-10">
      <div className="container-site">
        <Breadcrumbs align="center" items={[{ label: renew ? "Renew a server" : "Place an order" }]} />
        <div className="mt-8 text-center">
          <h1 className="display-h2 !text-[clamp(30px,4vw,44px)]">{renew ? "Renew your server." : "Place your order."}</h1>
          <p className="mx-auto mt-3 max-w-[52ch] text-[16px] leading-relaxed text-muted">
            {renew
              ? "Renewing adds another 30 days to the end of your current term."
              : "Your server is delivered after we verify your payment."}
          </p>
        </div>

        <div className="mt-12">
          <Suspense fallback={<div aria-hidden className="skeleton mx-auto h-[560px] max-w-[1040px]" />}>
            <OrderFlow
              catalog={{ locations: catalog.locations, plans: catalog.plans, pricing: catalog.pricing }}
              session={session}
              renew={renew}
              backendReady={isSupabaseConfigured}
              fullChoice={fullChoice}
              needsCountry={needsCountry}
            />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
