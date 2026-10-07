"use client";

import { useId, useState } from "react";

/**
 * A date-and-time picker that submits an unambiguous ISO timestamp. The browser's picker works in the
 * viewer's own time zone; the hidden field carries the exact instant (with its offset), so the server
 * never has to guess which time zone was meant. Empty means "not set".
 */
export function LocalDateTimeField({ label, name, hint, error }: { label: string; name: string; hint?: string; error?: string[] }) {
  const id = useId();
  const [iso, setIso] = useState("");
  const hasError = Boolean(error?.length);

  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        type="datetime-local"
        className="field-input"
        onChange={(e) => {
          const d = e.target.value ? new Date(e.target.value) : null;
          setIso(d && !Number.isNaN(d.getTime()) ? d.toISOString() : "");
        }}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? `${id}-error` : hint ? `${id}-hint` : undefined}
      />
      <input type="hidden" name={name} value={iso} />
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
