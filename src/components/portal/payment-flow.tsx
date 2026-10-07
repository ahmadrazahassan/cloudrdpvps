"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { submitPaymentProof } from "@/app/(portal)/dashboard/orders/actions";
import { FormError, fieldError } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { PaymentLogo } from "@/components/shared/payment-logo";
import { Field, TextareaField } from "@/components/ui/field";
import { formatUsd } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";
import { FileDropzone } from "./file-dropzone";

export interface PayMethod {
  id: string;
  name: string;
  type: "bank" | "mobile_wallet" | "upi" | "crypto" | "other";
  regions: string[];
  currencyCode: string | null;
  ratePerUsd: number | null;
  feeNote: string | null;
  details: { label: string; value: string }[];
  qrUrl: string | null;
  requiresReference: boolean;
  /** Admin-written instructions, already rendered on the server. */
  instructions: ReactNode;
}

const TYPE_LABEL: Record<PayMethod["type"], string> = {
  bank: "Bank transfer",
  mobile_wallet: "Mobile wallet",
  upi: "UPI",
  crypto: "Crypto",
  other: "Other",
};

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  }
}

/** Steps 1–3 of paying: choose a method, send the money, upload proof. */
export function PaymentFlow({
  orderId,
  orderNumber,
  totalCents,
  defaultRegion,
  methods,
  rejectionMessage,
  initialMethodId,
}: {
  orderId: string;
  orderNumber: string;
  totalCents: number;
  /** The customer's billing country (ISO-2). Every method is shown; the ones for this country come first. */
  defaultRegion: string | null;
  methods: PayMethod[];
  /** Why the last proof was rejected, when this is a retry. */
  rejectionMessage?: string | null;
  /** Preselect a method (from ?method=); otherwise one is chosen automatically only when it's the sole option. */
  initialMethodId?: string;
}) {
  // Every method we accept is on offer — nothing is hidden. Listed first: the ones for the customer's own country, then
  // the international ones, then the rest. (The sort is stable, so the owner's order is kept within each group.)
  const rank = (m: PayMethod) => (defaultRegion && m.regions.includes(defaultRegion) ? 0 : m.regions.length === 0 ? 1 : 2);
  const visible = [...methods].sort((a, b) => rank(a) - rank(b));

  const [chosenId, setChosenId] = useState<string | null>(
    methods.some((m) => m.id === initialMethodId) ? (initialMethodId ?? null) : visible.length === 1 ? visible[0]!.id : null,
  );
  const method = methods.find((m) => m.id === chosenId) ?? null;
  const [state, formAction, pending] = useActionState(submitPaymentProof, null);

  if (methods.length === 0) {
    return (
      <div className="border-l-2 border-warn pl-4">
        <p className="text-[16px] font-semibold text-ink">Payment methods aren&apos;t available yet.</p>
        <p className="mt-1.5 max-w-[56ch] text-[15px] leading-relaxed text-ink-2">
          Your order is saved. We&apos;ll let you know as soon as you can pay. If you need help in the meantime, open a
          ticket and mention order {orderNumber}.
        </p>
        <div className="mt-5">
          <Link href="/dashboard/tickets/new" className="text-link text-[15px]">
            Contact support
          </Link>
        </div>
      </div>
    );
  }

  const localAmount =
    method?.ratePerUsd && method.currencyCode ? Math.round((totalCents / 100) * method.ratePerUsd * 100) / 100 : null;
  const networkDetail = method?.type === "crypto" ? method.details.find((d) => /network/i.test(d.label)) : undefined;

  return (
    <div className="space-y-12">
      {rejectionMessage !== undefined && rejectionMessage !== null && (
        <div role="alert" className="border-l-2 border-bad pl-4">
          <p className="text-[16px] font-semibold text-bad">Your last payment proof was rejected.</p>
          <p className="mt-1.5 max-w-[60ch] text-[15px] leading-relaxed text-ink-2">{rejectionMessage}</p>
          <p className="mt-1.5 text-[14px] text-muted">Check the details below and submit new proof.</p>
        </div>
      )}

      {/* 01 — choose a method */}
      <section aria-labelledby="step-method">
        <h2 id="step-method" className="flex items-baseline gap-3 text-[19px] font-semibold tracking-[-0.014em] text-ink">
          <span className="num-tabular label-caps">01</span>Choose a payment method
        </h2>
        <div role="radiogroup" aria-labelledby="step-method" className="mt-5 border-t border-line">
          {visible.map((m) => {
            const checked = m.id === chosenId;
            return (
              <label
                key={m.id}
                className={cn(
                  "relative flex cursor-pointer items-center gap-4 border-b border-line py-4 pl-5 pr-2 hover:bg-black/[0.02]",
                  checked && "before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-lav-600",
                )}
              >
                <input
                  type="radio"
                  name="method"
                  value={m.id}
                  checked={checked}
                  onChange={() => setChosenId(m.id)}
                  className="h-[18px] w-[18px] shrink-0 accent-lav-600"
                />
                <span className="flex h-8 w-12 shrink-0 items-center justify-center">
                  <PaymentLogo name={m.name} type={m.type} className="max-w-full object-contain" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold text-ink">{m.name}</span>
                  <span className="block text-[13px] text-muted">
                    {TYPE_LABEL[m.type]}
                    {m.feeNote ? ` · ${m.feeNote}` : ""}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {method && (
        <form action={formAction} className="space-y-12" noValidate>
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="methodId" value={method.id} />

          {/* 02 — send the money */}
          <section aria-labelledby="step-send">
            <h2 id="step-send" className="flex items-baseline gap-3 text-[19px] font-semibold tracking-[-0.014em] text-ink">
              <span className="num-tabular label-caps">02</span>Send your payment
            </h2>

            <div className="mt-5 border-y border-line py-5">
              <p className="label-caps">Amount to send</p>
              {localAmount !== null && method.currencyCode ? (
                <>
                  <p className="num-tabular mt-2 flex items-center gap-1 font-display text-[30px] font-medium leading-none tracking-[-0.025em] text-ink">
                    {money(localAmount, method.currencyCode)}
                    <CopyButton value={String(localAmount)} label="Copy amount" />
                  </p>
                  <p className="num-tabular mt-2 text-[13px] text-muted">
                    {formatUsd(totalCents, { cents: true })} USD at 1 USD = {method.ratePerUsd} {method.currencyCode}
                  </p>
                </>
              ) : (
                <p className="num-tabular mt-2 flex items-center gap-1 font-display text-[30px] font-medium leading-none tracking-[-0.025em] text-ink">
                  {formatUsd(totalCents, { cents: true })} <span className="text-[16px] text-muted">USD</span>
                  <CopyButton value={(totalCents / 100).toFixed(2)} label="Copy amount" />
                </p>
              )}
            </div>

            {networkDetail && (
              <p className="mt-4 flex items-start gap-2.5 text-[14px] font-medium text-warn">
                <AlertTriangle size={18} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
                Send only on {networkDetail.value}. Funds sent on any other network cannot be recovered.
              </p>
            )}

            {method.details.length > 0 && (
              <dl className="mt-2">
                {method.details.map((d) => (
                  <div key={d.label} className="grid gap-1 border-b border-line py-3.5 sm:grid-cols-[170px_1fr] sm:items-center sm:gap-6">
                    <dt className="label-caps">{d.label}</dt>
                    <dd className="data-id flex items-center gap-1 break-all text-[15px] font-medium text-ink">
                      {d.value}
                      <CopyButton value={d.value} label={`Copy ${d.label}`} />
                    </dd>
                  </div>
                ))}
                <div className="grid gap-1 border-b border-line py-3.5 sm:grid-cols-[170px_1fr] sm:items-center sm:gap-6">
                  <dt className="label-caps">Payment note</dt>
                  <dd className="data-id flex items-center gap-1 text-[15px] font-medium text-ink">
                    {orderNumber}
                    <CopyButton value={orderNumber} label="Copy order number" />
                  </dd>
                </div>
              </dl>
            )}

            {method.qrUrl && (
              <figure className="mt-6">
                {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL; not optimisable by next/image */}
                <img src={method.qrUrl} alt={`QR code for ${method.name}`} className="h-[180px] w-[180px] border border-line object-contain" />
                <figcaption className="mt-2 text-[12px] text-muted">Scan with your banking or wallet app.</figcaption>
              </figure>
            )}

            {method.instructions && <div className="mt-6">{method.instructions}</div>}
          </section>

          {/* 03 — upload proof */}
          <section aria-labelledby="step-proof">
            <h2 id="step-proof" className="flex items-baseline gap-3 text-[19px] font-semibold tracking-[-0.014em] text-ink">
              <span className="num-tabular label-caps">03</span>Upload your proof
            </h2>
            <p className="mt-2 max-w-[56ch] text-[14px] leading-relaxed text-muted">
              A clear screenshot or PDF of the payment confirmation. Our team checks it against what we received.
            </p>

            <div className="mt-6 max-w-[520px] space-y-5">
              <FormError state={state} />
              <FileDropzone name="proof" label="Payment proof" required error={fieldError(state, "proof")?.[0]} />
              <Field
                label={method.requiresReference ? "Transaction reference" : "Transaction reference (optional)"}
                name="reference"
                required={method.requiresReference}
                autoComplete="off"
                hint={method.requiresReference ? "Required for this method — it's on your payment confirmation." : undefined}
                error={fieldError(state, "reference")}
              />
              <TextareaField
                label="Note for our team (optional)"
                name="note"
                rows={3}
                error={fieldError(state, "note")}
              />
              <Button type="submit" size="lg" loading={pending}>
                Submit payment proof
              </Button>
              <p className="text-[13px] leading-relaxed text-muted">
                We review payments by hand, then deliver your server. You&apos;ll get an email and a notification when it
                changes.
              </p>
            </div>
          </section>
        </form>
      )}
    </div>
  );
}
