"use client";

import { ArrowLeftRight, Check, Cpu, Gauge, HardDrive, MemoryStick } from "lucide-react";
import Link from "next/link";
import { parseAsString, useQueryStates } from "nuqs";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { SignOutLink } from "@/components/auth/sign-out-link";
import { WindowsLogo } from "@/components/brand/windows-logo";
import { CountryFlag } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
import type { Location, Plan, PlanPricing, ProductType } from "@/content/catalog";
import { effectiveStep, isOrderable, orderPath, planAvailability, plansOf, resolveSelection, type Selection, type Step } from "@/lib/checkout";
import { cn, formatPort, formatUsd } from "@/lib/utils";
import { AccountStep } from "./account-step";
import { CountryPicker } from "./country-picker";
import { OrderSummary, type Applied } from "./order-summary";
import { ReviewStep, type RenewInfo, type SessionInfo } from "./review-step";
import { Segmented } from "./segmented";

export type { RenewInfo, SessionInfo };

const urlOpts = { history: "replace", scroll: false, shallow: true } as const;

const PRODUCTS: { id: ProductType; label: string }[] = [
  { id: "rdp", label: "Windows RDP" },
  { id: "vps", label: "Windows VPS" },
];

const shortName = (name: string) => name.replace(/^(RDP|VPS)\s+/i, "");

/** One step of the order: a numbered row that shows its choice when finished and opens when it's the current one. */
function FlowSection({
  id,
  index,
  title,
  status,
  summary,
  onEdit,
  children,
}: {
  id: string;
  index: number;
  title: string;
  status: "active" | "done" | "todo";
  summary?: ReactNode;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} tabIndex={-1} className="scroll-mt-24 border-t border-line py-7 outline-none first:border-t-0 first:pt-0">
      <div className="flex items-start gap-4">
        <span aria-hidden className={cn("num-tabular mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center text-[14px] font-semibold", status === "todo" ? "text-muted/70" : "text-ink")}>
          {status === "done" ? <Check size={18} strokeWidth={2.25} className="text-lav-600" /> : index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id={`${id}-title`} className={cn("font-display text-[21px] font-semibold tracking-[-0.016em]", status === "todo" ? "text-muted" : "text-ink")}>
              {title}
            </h2>
            {status === "done" && onEdit && (
              <button type="button" onClick={onEdit} className="text-link shrink-0 text-[13.5px] font-medium">
                Change<span className="sr-only"> {title.toLowerCase()}</span>
              </button>
            )}
          </div>
          {status !== "active" && summary ? <div className={cn("mt-1.5 text-[15px]", status === "todo" ? "text-muted" : "text-ink-2")}>{summary}</div> : null}
          {status === "active" ? <div className="mt-6">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}

/**
 * The whole order, on one address, kept short. Three rows: Plan, Account, Review. Each shows what you chose once it's done and
 * opens when it's the one you're on — so someone who arrives with a plan and country already chosen sees them in the Plan row
 * (with "Change") and goes straight on. Sign-in and sign-up happen right here; someone already signed in sees who they are
 * and is never asked to sign in again. The choices and the step live in the URL, so it can be shared, reloaded or returned
 * to after a sign-in or an email confirmation, and the Back button walks back through the steps.
 */
export function OrderFlow({
  catalog,
  session,
  renew,
  backendReady,
  fullChoice,
  needsCountry,
}: {
  catalog: { locations: Location[]; plans: Plan[]; pricing: PlanPricing[] };
  session: SessionInfo;
  renew: RenewInfo | null;
  backendReady: boolean;
  /** The visitor followed a link that already named both a plan and a country. */
  fullChoice: boolean;
  /** …or one that named a plan but no country (the pricing cards): the country is the one thing left to choose. */
  needsCountry: boolean;
}) {
  const uid = useId();
  const [q, setQ] = useQueryStates(
    { product: parseAsString, country: parseAsString, plan: parseAsString, step: parseAsString },
    urlOpts,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [countryTouched, setCountryTouched] = useState(false);
  const [couponState, setCouponState] = useState<{ key: string; value: Applied } | null>(null);

  const signedIn = session.state !== "guest";
  const prefer = session.state === "guest" ? null : session.billingCountry;
  const sel = useMemo(
    () => resolveSelection(catalog, { product: q.product, country: q.country, plan: q.plan, prefer }),
    [catalog, q.product, q.country, q.plan, prefer],
  );
  const step = effectiveStep(q.step, signedIn, Boolean(renew), fullChoice);

  // Keep the address honest: always the full configuration and the step, so a copy of it, a reload, or a return from signing
  // in lands on exactly this.
  useEffect(() => {
    if (!sel || renew) return;
    const want = { product: sel.product, country: sel.locationSlug, plan: sel.planSlug, step };
    if (q.product !== want.product || q.country !== want.country || q.plan !== want.plan || q.step !== want.step) void setQ(want);
  }, [sel, step, renew, q.product, q.country, q.plan, q.step, setQ]);

  // Moving between steps scrolls to the step now open (instead of leaving the page wherever the last step's scrollbar happened
  // to be — which, after a long first step, used to land on the footer) and moves focus there.
  const lastStep = useRef(step);
  useEffect(() => {
    if (lastStep.current === step) return;
    lastStep.current = step;
    const frame = window.requestAnimationFrame(() => {
      const el = document.getElementById(`${uid}-${step}`);
      el?.scrollIntoView({ block: "start" });
      el?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [step, uid]);

  if (!renew && !sel) {
    return (
      <p className="mx-auto max-w-[52ch] py-10 text-center text-[16px] text-ink-2">
        Nothing is available to order right now. Please check back soon or{" "}
        <Link href="/contact" className="text-link">
          contact us
        </Link>
        .
      </p>
    );
  }

  // What is being bought: either the chosen plan, or the existing service's plan (renewal).
  const product = renew?.product ?? sel!.product;
  const productLabel = product === "rdp" ? "Windows RDP" : "Windows VPS";
  const plans = plansOf(catalog, product);
  const location = renew ? catalog.locations.find((l) => l.id === renew.locationId) : catalog.locations.find((l) => l.slug === sel!.locationSlug);
  const plan = renew ? catalog.plans.find((p) => p.id === renew.planId) : plans.find((p) => p.slug === sel!.planSlug);
  const row = plan && location ? catalog.pricing.find((p) => p.planId === plan.id && p.locationId === location.id) : undefined;
  const priceCents = renew ? renew.priceCents : (row?.priceCents ?? null);
  const orderable = renew ? renew.orderable && priceCents !== null : Boolean(plan && location && isOrderable(catalog, plan.id, location.id));

  const couponKey = `${plan?.id}:${location?.id}`;
  const applied = couponState && couponState.key === couponKey ? couponState.value : null;

  const reviewHref = renew ? `/order/new?renew=${renew.serviceId}` : sel ? orderPath(sel, "review") : "/order/new";
  const shareHref = renew ? `/order/new?renew=${renew.serviceId}` : sel ? orderPath(sel) : "/order/new";

  const go = (next: Step) => void setQ({ step: next }, { history: "push" });
  const next = signedIn ? "review" : "account";

  // ---- choices ----------------------------------------------------------------------------------------------------
  const commit = (s: Selection | null) => {
    if (s) void setQ({ product: s.product, country: s.locationSlug, plan: s.planSlug });
  };
  const locName = (slug: string) => catalog.locations.find((l) => l.slug === slug)?.name ?? "another country";
  const planName = (s: Selection) => catalog.plans.find((p) => p.product === s.product && p.slug === s.planSlug)?.name ?? "another plan";

  const chooseProduct = (p: ProductType) => {
    if (!sel || p === sel.product) return;
    const s = resolveSelection(catalog, { product: p, country: sel.locationSlug });
    setNotice(s && s.locationSlug !== sel.locationSlug ? `${locName(sel.locationSlug)} doesn't have ${p === "rdp" ? "Windows RDP" : "Windows VPS"} in stock, so we moved you to ${locName(s.locationSlug)}.` : null);
    commit(s);
  };
  const chooseCountry = (slug: string) => {
    if (!sel || slug === sel.locationSlug) return;
    setCountryTouched(true);
    const s = resolveSelection(catalog, { product: sel.product, country: slug, plan: sel.planSlug });
    const wanted = plans.find((p) => p.slug === sel.planSlug);
    const target = catalog.locations.find((l) => l.slug === slug);
    const was = wanted && target ? planAvailability(catalog, wanted.id, target.id) : null;
    // If the plan you had isn't sold in the new country, say so — and which plan you were moved to.
    setNotice(
      s && s.planSlug !== sel.planSlug && wanted && target && was && !was.ok
        ? `${wanted.name} ${was.reason === "sold_out" ? "is out of stock in" : "isn't offered in"} ${target.name}, so we switched you to ${planName(s)}.`
        : null,
    );
    commit(s);
  };
  const choosePlan = (slug: string) => {
    if (!sel) return;
    setNotice(null);
    commit({ ...sel, planSlug: slug });
  };
  const planBlocked = (slug: string) => {
    const p = plans.find((x) => x.slug === slug);
    if (!p || !location) return;
    const a = planAvailability(catalog, p.id, location.id);
    if (!a.ok) setNotice(`${p.name} ${a.reason === "sold_out" ? "is out of stock in" : "isn't offered in"} ${location.name}. Choose another plan, or another country.`);
  };

  const account = session.state === "guest" ? null : { name: session.name, email: session.email };
  const highlightCountry = needsCountry && !countryTouched && step === "plan";

  const planSummary = (
    <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <span className="inline-flex items-center gap-2">
        <WindowsLogo size={14} />
        {productLabel}
      </span>
      <span className="text-muted">·</span>
      <strong className="font-semibold text-ink">{plan?.name ?? "—"}</strong>
      <span className="text-muted">·</span>
      {location && (
        <span className="inline-flex items-center gap-2">
          <CountryFlag iso2={location.iso2} />
          {location.name}
        </span>
      )}
      {priceCents !== null && (
        <>
          <span className="text-muted">·</span>
          <span className="num-tabular">{formatUsd(priceCents)} / 30 days</span>
        </>
      )}
    </span>
  );

  return (
    <div className="mx-auto w-full max-w-[1040px]">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-14">
        <div className="min-w-0">
          {/* ------------------------------------------------ 1. plan ------------------------------------------------ */}
          <FlowSection id={`${uid}-plan`} index={1} title="Your plan" status={step === "plan" ? "active" : "done"} summary={planSummary} onEdit={renew ? undefined : () => go("plan")}>
            {sel && (
              <div className="space-y-7">
                <div>
                  <p className="label-caps mb-2.5">Product</p>
                  <Segmented
                    label="Product"
                    value={sel.product}
                    onChange={chooseProduct}
                    options={PRODUCTS.map((p) => ({ value: p.id, label: p.label }))}
                  />
                </div>

                <div>
                  <p className="label-caps mb-2.5">Plan</p>
                  <Segmented
                    label={`${productLabel} plan`}
                    value={sel.planSlug}
                    onChange={choosePlan}
                    onBlocked={planBlocked}
                    size="lg"
                    options={plans.map((p) => {
                      const a = location ? planAvailability(catalog, p.id, location.id) : null;
                      const r = location ? catalog.pricing.find((x) => x.planId === p.id && x.locationId === location.id) : undefined;
                      return {
                        value: p.slug,
                        label: shortName(p.name),
                        sub: a && !a.ok ? (a.reason === "sold_out" ? "Out of stock" : "Not offered") : r ? formatUsd(r.priceCents) : "",
                        unavailable: Boolean(a && !a.ok),
                        accessibleName: `${p.name}${r && a?.ok ? `, ${formatUsd(r.priceCents)} per 30 days` : ""}${a && !a.ok ? ", unavailable here" : ""}`,
                      };
                    })}
                  />
                  {plan && (
                    <ul className="num-tabular mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13.5px] text-ink-2" aria-label={`${plan.name} includes`}>
                      {[
                        { icon: Cpu, text: `${plan.vcpu} vCPU` },
                        { icon: MemoryStick, text: `${plan.ramGb} GB RAM` },
                        { icon: HardDrive, text: `${plan.storageGb} GB NVMe` },
                        { icon: ArrowLeftRight, text: `${plan.bandwidthTb} TB bandwidth` },
                        { icon: Gauge, text: `${formatPort(plan.portMbps)} port` },
                      ].map((s) => (
                        <li key={s.text} className="inline-flex items-center gap-2">
                          <s.icon size={15} strokeWidth={1.6} aria-hidden className="text-muted" />
                          {s.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="label-caps mb-2.5">Country</p>
                  <CountryPicker catalog={catalog} product={sel.product} productLabel={productLabel} selected={location} onSelect={chooseCountry} invalid={highlightCountry} />
                  {highlightCountry && <p className="mt-2 text-[13px] text-lav-700">Check the country — it sets the price and where your server runs.</p>}
                </div>

                <p role="status" className={cn("min-h-[20px] text-[14px] leading-relaxed", notice ? "text-warn" : "text-transparent")}>
                  {notice ?? "."}
                </p>

                <Button size="lg" disabled={!orderable} onClick={() => go(next)} className="w-full sm:w-auto sm:min-w-[220px]">
                  Continue
                </Button>
              </div>
            )}
          </FlowSection>

          {/* ----------------------------------------------- 2. account ---------------------------------------------- */}
          <FlowSection
            id={`${uid}-account`}
            index={2}
            title="Your account"
            status={signedIn ? "done" : step === "account" ? "active" : "todo"}
            summary={
              account ? (
                <span>
                  Signed in as <strong className="font-semibold text-ink">{account.name}</strong>
                  <span className="text-muted"> · {account.email}</span>
                  <span className="ml-3 text-[13px] text-muted">
                    Not you? <SignOutLink label="Switch account" next={shareHref} />
                  </span>
                </span>
              ) : (
                "Sign in or create an account to continue."
              )
            }
          >
            <AccountStep nextUrl={reviewHref} backendReady={backendReady} />
          </FlowSection>

          {/* ------------------------------------------------ 3. review ---------------------------------------------- */}
          <FlowSection id={`${uid}-review`} index={3} title={renew ? "Review your renewal" : "Place your order"} status={step === "review" ? "active" : "todo"} summary="Check it over and place the order.">
            {session.state !== "guest" && (
              <ReviewStep
                session={session}
                plan={plan}
                location={location}
                priceCents={priceCents}
                orderable={orderable}
                renew={renew}
                applied={applied}
                onApplied={(a) => setCouponState(a ? { key: couponKey, value: a } : null)}
                onChangePlan={() => go("plan")}
                reviewHref={reviewHref}
              />
            )}
          </FlowSection>
        </div>

        <OrderSummary product={product} plan={plan} location={location} priceCents={priceCents} orderable={orderable} applied={applied} href={shareHref} />
      </div>
    </div>
  );
}
