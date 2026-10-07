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
import { Card, CardHeader } from "./cards";
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
      <Card padded role="status">
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
      </Card>
    );
  }

  const localAmount =
    method?.ratePerUsd && method.currencyCode ? Math.round((totalCents / 100) * method.ratePerUsd * 100) / 100 : null;
  const networkDetail = method?.type === "crypto" ? method.details.find((d) => /network/i.test(d.label)) : undefined;

  return (
    <div className="space-y-5">
      {rejectionMessage !== undefined && rejectionMessage !== null && (
        <div role="alert" className="rounded-card bg-bad-bg px-5 py-4">
          <p className="text-[16px] font-semibold text-bad-ink">Your last payment proof was rejected.</p>
          <p className="mt-1.5 max-w-[60ch] text-[15px] leading-relaxed text-ink-2">{rejectionMessage}</p>
          <p className="mt-1.5 text-[14px] text-ink-2">Check the details below and submit new proof.</p>
        </div>
      )}

      {/* 01 — choose a method */}
      <Card aria-labelledby="step-method">
        <CardHeader headingId="step-method" divided title={<StepTitle n="01">Choose a payment method</StepTitle>} />
        <div role="radiogroup" aria-labelledby="step-method" className="grid gap-3 p-5 sm:p-6">
          {visible.map((m) => {
            const checked = m.id === chosenId;
            return (
              <label
                key={m.id}
                className={cn(
                  "flex cursor-pointer items-center gap-4 rounded-card border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-lav-500",
                  checked ? "border-lav-600 bg-lav-50" : "border-line hover:border-line-2 hover:bg-surface-2",
                )}
              >
                <input
                  type="radio"
                  name="method"
                  value={m.id}
                  checked={checked}
                  onChange={() => setChosenId(m.id)}
                  className="h-[18px] w-[18px] shrink-0 accent-lav-600 focus-visible:outline-none"
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
      </Card>

      {method && (
        <form action={formAction} className="space-y-5" noValidate>
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="methodId" value={method.id} />

          {/* 02 — send the money */}
          <Card aria-labelledby="step-send">
            <CardHeader headingId="step-send" divided title={<StepTitle n="02">Send your payment</StepTitle>} />
            <div className="space-y-5 p-5 sm:p-6">
              <div className="rounded-card bg-lav-50 px-5 py-4">
                <p className="text-[13px] font-medium text-lav-800">Amount to send</p>
                {localAmount !== null && method.currencyCode ? (
                  <>
                    <p className="num-tabular mt-2 flex items-center gap-1 font-display text-[32px] font-medium leading-none tracking-[-0.028em] text-ink">
                      {money(localAmount, method.currencyCode)}
                      <CopyButton value={String(localAmount)} label="Copy amount" />
                    </p>
                    <p className="num-tabular mt-2 text-[13px] text-ink-2">
                      {formatUsd(totalCents, { cents: true })} USD at 1 USD = {method.ratePerUsd} {method.currencyCode}
                    </p>
                  </>
                ) : (
                  <p className="num-tabular mt-2 flex items-center gap-1 font-display text-[32px] font-medium leading-none tracking-[-0.028em] text-ink">
                    {formatUsd(totalCents, { cents: true })} <span className="text-[16px] text-muted">USD</span>
                    <CopyButton value={(totalCents / 100).toFixed(2)} label="Copy amount" />
                  </p>
                )}
              </div>

              {networkDetail && (
                <p className="flex items-start gap-2.5 rounded-card bg-warn-bg px-4 py-3 text-[14px] font-medium text-warn">
                  <AlertTriangle size={18} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
                  Send only on {networkDetail.value}. Funds sent on any other network cannot be recovered.
                </p>
              )}

              {method.details.length > 0 && (
                <dl className="grid gap-3 sm:grid-cols-2">
                  {method.details.map((d) => (
                    <div key={d.label} className="min-w-0 rounded-card bg-surface-2 px-4 py-3.5">
                      <dt className="text-[12px] font-medium text-muted">{d.label}</dt>
                      <dd className="data-id mt-1 flex items-center gap-1 break-all text-[15px] font-medium text-ink">
                        {d.value}
                        <CopyButton value={d.value} label={`Copy ${d.label}`} />
                      </dd>
                    </div>
                  ))}
                  <div className="min-w-0 rounded-card bg-surface-2 px-4 py-3.5">
                    <dt className="text-[12px] font-medium text-muted">Payment note</dt>
                    <dd className="data-id mt-1 flex items-center gap-1 text-[15px] font-medium text-ink">
                      {orderNumber}
                      <CopyButton value={orderNumber} label="Copy order number" />
                    </dd>
                  </div>
                </dl>
              )}

              {method.qrUrl && (
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL; not optimisable by next/image */}
                  <img src={method.qrUrl} alt={`QR code for ${method.name}`} className="h-[180px] w-[180px] rounded-card border border-line object-contain" />
                  <figcaption className="mt-2 text-[12px] text-muted">Scan with your banking or wallet app.</figcaption>
                </figure>
              )}

              {method.instructions && <div>{method.instructions}</div>}
            </div>
          </Card>

          {/* 03 — upload proof */}
          <Card aria-labelledby="step-proof">
            <CardHeader
              headingId="step-proof"
              divided
              title={<StepTitle n="03">Upload your proof</StepTitle>}
              description="A clear screenshot or PDF of the payment confirmation. Our team checks it against what we received."
            />
            <div className="max-w-[560px] space-y-5 p-5 sm:p-6">
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
          </Card>
        </form>
      )}
    </div>
  );
}

/** "01  Choose a payment method" — the step number in lavender, then the title. */
function StepTitle({ n, children }: { n: string; children: ReactNode }) {
  return (
    <>
      <span aria-hidden className="num-tabular mr-2.5 text-lav-600">
        {n}
      </span>
      {children}
    </>
  );
}
