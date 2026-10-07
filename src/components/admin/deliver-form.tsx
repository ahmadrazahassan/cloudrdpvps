"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { FormError, fieldError } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { deliverServer } from "@/lib/admin/actions/orders";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LocalDateTimeField } from "./local-datetime-field";
import { SecretField } from "./secret-field";

export interface StockOption {
  id: string;
  ip: string;
  port: number;
  supplier: string | null;
  addedAt: string;
}

const SOURCES = [
  { id: "manual", label: "Enter details" },
  { id: "inventory", label: "From stock" },
] as const;

/**
 * Deliver a server for a paid order: pick one from stock or type the details, set the Windows password
 * (generate one with a click), and send. The password is encrypted on the server before it reaches the
 * database; the customer's email never contains it. On success it opens the new server.
 */
export function DeliverForm({
  orderId,
  defaultLabel,
  termDays,
  stock,
  autoFocus,
}: {
  orderId: string;
  defaultLabel: string;
  termDays: number;
  stock: StockOption[];
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(deliverServer, null);
  const [source, setSource] = useState<"manual" | "inventory">(stock.length > 0 ? "inventory" : "manual");
  const [custom, setCustom] = useState(false);
  const [v, setV] = useState({ label: defaultLabel, hostname: "", ip: "", port: "3389", username: "Administrator", password: "", inventoryItemId: stock[0]?.id ?? "", note: "", expiryReason: "" });
  const [notify, setNotify] = useState(true);
  const bind = (key: keyof typeof v) => ({ name: key, value: v[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((p) => ({ ...p, [key]: e.target.value })) });

  useEffect(() => {
    if (state?.ok) router.push(`/admin/services/${state.data.serviceId}`);
  }, [state, router]);

  return (
    <form action={formAction} className="max-w-[640px] space-y-6" noValidate>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="source" value={source} />
      <FormError state={state} />

      <fieldset>
        <legend className="field-label">Server details</legend>
        <div role="radiogroup" aria-label="Where the server comes from" className="flex gap-6 border-b border-line">
          {SOURCES.map((s) => {
            const disabled = s.id === "inventory" && stock.length === 0;
            const active = source === s.id;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => setSource(s.id)}
                className={cn(
                  "relative -mb-px h-10 text-[14px] font-medium transition-colors disabled:cursor-not-allowed disabled:text-line-2",
                  active ? "text-ink" : "text-muted hover:text-ink",
                )}
              >
                {s.label}
                {s.id === "inventory" && <span className="num-tabular ml-2 text-[12px] text-muted">{stock.length}</span>}
                {active && <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-lav-600" />}
              </button>
            );
          })}
        </div>
      </fieldset>

      {source === "inventory" ? (
        <SelectField
          label="Server from stock"
          {...bind("inventoryItemId")}
          options={stock.map((s) => ({ value: s.id, label: `${s.ip}${s.port !== 3389 ? `:${s.port}` : ""} · ${s.supplier ?? "no supplier"} · added ${formatDate(s.addedAt)}` }))}
          hint="Its saved login is used as is — nothing to type."
          error={fieldError(state, "inventoryItemId")}
        />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-[1fr_120px]">
            <Field label="IP address" {...bind("ip")} inputMode="text" autoComplete="off" autoFocus={autoFocus} placeholder="203.0.113.10" error={fieldError(state, "ip")} />
            <Field label="RDP port" {...bind("port")} inputMode="numeric" autoComplete="off" error={fieldError(state, "port")} />
          </div>
          <Field label="Windows username" {...bind("username")} autoComplete="off" error={fieldError(state, "username")} />
          <SecretField
            label="Windows password"
            name="password"
            value={v.password}
            onChange={(password) => setV((p) => ({ ...p, password }))}
            error={fieldError(state, "password")}
            hint="Stored encrypted. The customer sees it only inside their dashboard."
          />
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Server name (optional)" {...bind("label")} autoComplete="off" hint="Shown to the customer. Defaults to the plan name." error={fieldError(state, "label")} />
        <Field label="Hostname (optional)" {...bind("hostname")} autoComplete="off" error={fieldError(state, "hostname")} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <LocalDateTimeField label="Starts" name="startsAt" hint="Leave empty to start now." error={fieldError(state, "startsAt")} />
        <div>
          <p className="field-label">Expires</p>
          <p className="flex h-12 items-center text-[14px] text-ink-2">{custom ? "Set below" : `Automatically ${termDays} days after the start`}</p>
        </div>
      </div>

      <label className="check">
        <input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} />
        <span>Use a different expiry (needs a reason)</span>
      </label>
      {custom && (
        <div className="grid gap-5 border-l-2 border-line-2 pl-5 sm:grid-cols-2">
          <LocalDateTimeField label="Expires at" name="expiresAt" error={fieldError(state, "expiresAt")} />
          <Field label="Reason" {...bind("expiryReason")} autoComplete="off" placeholder="e.g. Paid for 60 days" error={fieldError(state, "expiryReason")} />
        </div>
      )}

      <TextareaField label="Internal note (optional)" {...bind("note")} hint="Only staff see this." className="[&_textarea]:min-h-[80px]" error={fieldError(state, "note")} />

      <label className="check">
        <input type="checkbox" name="notify" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        <span>Notify the customer (in-app and email — the email never includes the password)</span>
      </label>

      <Button type="submit" size="lg" loading={pending}>
        Deliver server
      </Button>
    </form>
  );
}
