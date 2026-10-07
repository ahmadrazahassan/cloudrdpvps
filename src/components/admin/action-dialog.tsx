"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field, SelectField, TextareaField } from "@/components/ui/field";
import type { ActionResult } from "@/lib/action";
import { SecretField } from "./secret-field";

interface FieldBase {
  name: string;
  label: string;
  required?: boolean;
  hint?: string;
  /** Starting value. A function is evaluated each time the dialog opens (e.g. to generate a code). */
  defaultValue?: string | (() => string);
  /** Show this field only while another field has one of these values. */
  when?: { name: string; in: string[] };
  /** Share a row with the next half-width field (side by side from the `sm` breakpoint). */
  half?: boolean;
}

/** "2026-12-31T14:30:00.000Z" → "2026-12-31T16:30" in the viewer's time zone, for <input type="datetime-local">. */
function isoToLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const initial = (f: FieldBase) => (typeof f.defaultValue === "function" ? f.defaultValue() : (f.defaultValue ?? ""));

export type DialogField =
  | (FieldBase & { kind: "select"; options: readonly string[] | { value: string; label: string }[]; placeholder?: string })
  | (FieldBase & { kind: "text"; placeholder?: string; inputMode?: "decimal" | "numeric" | "text" })
  | (FieldBase & { kind: "textarea"; placeholder?: string })
  /** Picks a date and time in the viewer's time zone; the value sent is the exact ISO instant. */
  | (FieldBase & { kind: "datetime" })
  /** A password with show / generate / copy. */
  | (FieldBase & { kind: "secret" })
  /** A checkbox; the value sent is "on" or "". */
  | (FieldBase & { kind: "check" });

/**
 * One dialog for every "are you sure, and why?" in the console. The title restates the object
 * ("Suspend FRA-web-01?"), the fields collect a preset reason and details, and field errors from the
 * server action appear beside the field they belong to. Flat: page colour, hairline border, no shadow.
 */
export function ActionDialog({
  trigger,
  title,
  description,
  confirmLabel,
  danger = false,
  size = "md",
  fields = [],
  preview,
  onSubmit,
  onDone,
}: {
  trigger: ReactNode;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  /** "lg" is wider, for forms with many fields. */
  size?: "md" | "lg";
  fields?: DialogField[];
  /** Extra text under the fields that reacts to what has been typed ("New expiry: 12 Dec 2026"). */
  preview?: (values: Record<string, string>) => ReactNode;
  onSubmit: (values: Record<string, string>) => Promise<ActionResult<unknown>>;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();

  const reset = () => {
    setValues(Object.fromEntries(fields.map((f) => [f.name, initial(f)])));
    setError(null);
    setFieldErrors({});
  };

  const visible = (f: FieldBase) => !f.when || f.when.in.includes(values[f.when.name] ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    // fields that are hidden right now are not sent
    const sent = Object.fromEntries(Object.entries(values).filter(([k]) => visible(fields.find((f) => f.name === k) ?? { name: k, label: "" })));
    start(async () => {
      const result = await onSubmit(sent);
      if (result.ok) {
        setOpen(false);
        onDone?.();
      } else {
        setError(result.fieldErrors && Object.keys(result.fieldErrors).length > 0 ? null : result.message);
        setFieldErrors(result.fieldErrors ?? {});
      }
    });
  }

  const set = (name: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [name]: e.target.value }));

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        if (o) reset();
        setOpen(o);
      }}
    >
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-ink/30 data-[state=open]:animate-[fade-in_0.2s_ease-out]" />
        <Dialog.Content
          className={`fixed left-1/2 top-1/2 z-[70] max-h-[92dvh] w-[calc(100%-32px)] ${size === "lg" ? "max-w-[660px]" : "max-w-[480px]"} -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-panel border border-black/[0.06] bg-surface p-7 shadow-2 data-[state=open]:animate-[fade-in_0.15s_ease-out]`}
        >
          <Dialog.Title className="font-display text-[20px] font-semibold tracking-[-0.016em] text-ink">{title}</Dialog.Title>
          {description ? (
            <Dialog.Description asChild>
              <div className="mt-2.5 text-[14.5px] leading-relaxed text-ink-2">{description}</div>
            </Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">{title}</Dialog.Description>
          )}
          <form onSubmit={submit} noValidate className="mt-6 space-y-5">
            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              {fields.filter(visible).map((f) => {
                const err = fieldErrors[f.name];
                const cell = f.half ? "col-span-2 sm:col-span-1" : "col-span-2";
                let control: ReactNode;
                if (f.kind === "check") {
                  control = (
                    <label className="check">
                      <input type="checkbox" checked={values[f.name] === "on"} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.checked ? "on" : "" }))} />
                      <span>{f.label}</span>
                    </label>
                  );
                } else if (f.kind === "secret") {
                  control = <SecretField label={f.label} name={f.name} value={values[f.name] ?? ""} onChange={(val) => setValues((v) => ({ ...v, [f.name]: val }))} error={err} hint={f.hint} />;
                } else if (f.kind === "datetime") {
                  control = (
                    <Field
                      label={f.label}
                      type="datetime-local"
                      name={`${f.name}-local`}
                      value={isoToLocalInput(values[f.name] ?? "")}
                      error={err}
                      hint={f.hint}
                      onChange={(e) => {
                        const d = e.target.value ? new Date(e.target.value) : null;
                        setValues((v) => ({ ...v, [f.name]: d && !Number.isNaN(d.getTime()) ? d.toISOString() : "" }));
                      }}
                    />
                  );
                } else {
                  const common = { label: f.label, name: f.name, value: values[f.name] ?? "", onChange: set(f.name), error: err, hint: f.hint, required: f.required } as const;
                  if (f.kind === "select") {
                    const options = f.options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
                    control = <SelectField {...common} options={options} placeholder={f.placeholder ?? "Choose…"} />;
                  } else if (f.kind === "textarea") {
                    control = <TextareaField {...common} placeholder={f.placeholder} className="[&_textarea]:min-h-[88px]" />;
                  } else {
                    control = <Field {...common} placeholder={f.placeholder} inputMode={f.inputMode} autoComplete="off" />;
                  }
                }
                return (
                  <div key={f.name} className={cell}>
                    {control}
                  </div>
                );
              })}
            </div>
            {preview && <div className="text-[14px] text-ink-2">{preview(values)}</div>}
            {error && (
              <p role="alert" className="form-note" data-tone="error">
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <Dialog.Close asChild>
                <Button variant="secondary" disabled={pending}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" variant={danger ? "danger" : "primary"} loading={pending}>
                {confirmLabel}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
