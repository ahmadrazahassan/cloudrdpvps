"use client";

import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useId, useState } from "react";
import { CopyButton } from "@/components/portal/copy-button";
import { generatePassword } from "@/lib/admin/generate-password";

/**
 * Password input for server credentials: show/hide, one-click "Generate" (20 characters from the Web
 * Crypto random source, made in this browser tab) and copy. Controlled, so a failed submit keeps what was typed.
 */
export function SecretField({
  label,
  name,
  value,
  onChange,
  error,
  hint,
  autoComplete = "new-password",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string[];
  hint?: string;
  autoComplete?: string;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const hasError = Boolean(error?.length);

  return (
    <div className="field">
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor={id} className="field-label !mb-0">
          {label}
        </label>
        <button
          type="button"
          onClick={() => {
            onChange(generatePassword(20));
            setVisible(true);
          }}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-lav-700 hover:text-lav-900"
        >
          <KeyRound size={15} strokeWidth={1.5} aria-hidden />
          Generate 20 characters
        </button>
      </div>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="field-input data-id pr-[88px]"
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? `${id}-error` : hint ? `${id}-hint` : undefined}
        />
        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center">
          <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} className={value ? "" : "pointer-events-none opacity-40"} />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="inline-flex h-8 w-8 items-center justify-center rounded-btn text-muted transition-colors hover:bg-black/[0.05] hover:text-ink"
          >
            {visible ? <EyeOff size={16} strokeWidth={1.5} aria-hidden /> : <Eye size={16} strokeWidth={1.5} aria-hidden />}
          </button>
        </div>
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
