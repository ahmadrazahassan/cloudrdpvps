"use client";

import { useId, useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

interface PasswordFieldProps extends Omit<ComponentProps<"input">, "id" | "type"> {
  label: string;
  error?: string[];
  hint?: string;
}

/** Password input with a text "Show / Hide" toggle (no icon chip, no filled background). */
export function PasswordField({ label, error, hint, className, ...input }: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const hasError = Boolean(error?.length);
  const describedBy = hasError ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn("field", className)}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          className="field-input pr-[72px]"
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          {...input}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-controls={id}
          className="label-caps absolute right-0 top-0 flex h-12 items-center px-4 text-ink-2 hover:text-ink"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {hasError ? (
        <p id={`${id}-error`} className="field-error">
          {error![0]}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
