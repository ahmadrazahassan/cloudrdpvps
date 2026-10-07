"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";
import { WindowsLogo } from "@/components/brand/windows-logo";
import { CountryFlag } from "@/components/shared/primitives";
import type { Location, Plan, ProductType } from "@/content/catalog";
import { cn, formatPort, formatUsd } from "@/lib/utils";

export interface Applied {
  code: string;
  discountCents: number;
  totalCents: number;
}

/**
 * The small order summary beside the form: what is chosen right now, and what it costs. It is a receipt — to change a choice,
 * use the plan section. "Copy link" gives the exact configuration as an address, to share or reopen later.
 */
export function OrderSummary({
  product,
  plan,
  location,
  priceCents,
  orderable,
  applied,
  href,
  className,
}: {
  product: ProductType;
  plan?: Plan;
  location?: Location;
  priceCents: number | null;
  orderable: boolean;
  applied: Applied | null;
  /** Path + query of this exact configuration. */
  href: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const productLabel = product === "rdp" ? "Windows RDP" : "Windows VPS";

  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(href, window.location.origin).toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard blocked: the address bar already holds the link */
    }
  }

  return (
    <aside aria-label="Order summary" className={cn("rounded-[22px] bg-white p-6 shadow-[0_1px_2px_rgb(18_18_20/0.05),0_16px_40px_-20px_rgb(18_18_20/0.18)] lg:sticky lg:top-24 lg:self-start", className)}>
      <p className="label-caps">Summary</p>

      <div className="mt-5 flex items-start gap-3">
        <WindowsLogo size={26} className="mt-0.5" />
        <div className="min-w-0">
          <p className="font-display text-[22px] font-semibold leading-tight tracking-[-0.018em] text-ink">{plan ? plan.name : productLabel}</p>
          <p className="mt-1 text-[14px] text-muted">{productLabel}</p>
        </div>
      </div>

      <dl className="mt-5 space-y-3 border-t border-line pt-5 text-[14px]">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">Country</dt>
          <dd className="flex min-w-0 items-center gap-2 font-medium text-ink">
            {location ? (
              <>
                <CountryFlag iso2={location.iso2} />
                <span className="truncate">{location.name}</span>
              </>
            ) : (
              <span className="font-normal text-muted">Not chosen</span>
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">System</dt>
          <dd className="font-medium text-ink">Windows Server</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">Term</dt>
          <dd className="font-medium text-ink">30 days</dd>
        </div>
      </dl>
      {plan && (
        <p className="num-tabular mt-4 text-[12.5px] leading-relaxed text-muted">
          {plan.vcpu} vCPU · {plan.ramGb} GB RAM · {plan.storageGb} GB NVMe · {plan.bandwidthTb} TB · {formatPort(plan.portMbps)}
        </p>
      )}

      <div className="mt-5 border-t border-line pt-5">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[14px] text-muted">Total</p>
          {priceCents !== null && orderable ? (
            applied ? (
              <p className="num-tabular text-right">
                <span className="mr-2 text-[13px] text-muted line-through">{formatUsd(priceCents, { cents: true })}</span>
                <span className="font-display text-[30px] font-medium tracking-[-0.03em] text-ink">{formatUsd(applied.totalCents, { cents: true })}</span>
              </p>
            ) : (
              <p className="num-tabular font-display text-[30px] font-medium tracking-[-0.03em] text-ink">{formatUsd(priceCents, { cents: true })}</p>
            )
          ) : (
            <p className="text-[14px] text-muted">{plan && location ? "Unavailable here" : "—"}</p>
          )}
        </div>
        {applied && (
          <p className="num-tabular mt-1 text-right text-[13px] text-ok">
            {applied.code.toUpperCase()}: −{formatUsd(applied.discountCents, { cents: true })}
          </p>
        )}
        <p className="mt-2 text-[12px] leading-relaxed text-muted">US dollars. Nothing is charged until you pay.</p>
      </div>

      <button type="button" onClick={copy} className="text-link mt-5 inline-flex items-center gap-2 text-[13px] font-medium">
        {copied ? <Check size={14} strokeWidth={2} aria-hidden /> : <Link2 size={14} strokeWidth={1.75} aria-hidden />}
        {copied ? "Link copied" : "Copy link to this order"}
      </button>
      <span role="status" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
    </aside>
  );
}
