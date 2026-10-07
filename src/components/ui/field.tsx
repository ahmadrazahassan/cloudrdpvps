import { ChevronDown } from "lucide-react";
import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

interface FieldChrome {
  label: string;
  /** Messages for this field (the first one is shown). */
  error?: string[];
  hint?: string;
}

export interface FieldProps extends Omit<ComponentProps<"input">, "id">, FieldChrome {}

function ids(id: string, hasError: boolean, hint?: string) {
  return {
    error: `${id}-error`,
    hint: `${id}-hint`,
    describedBy: hasError ? `${id}-error` : hint ? `${id}-hint` : undefined,
  };
}

function Message({ id, error, hint }: { id: string; error?: string[]; hint?: string }) {
  if (error?.length) {
    return (
      <p id={`${id}-error`} className="field-error">
        {error[0]}
      </p>
    );
  }
  return hint ? (
    <p id={`${id}-hint`} className="field-hint">
      {hint}
    </p>
  ) : null;
}

/** Labelled text input with an accessible hint/error. Server- and client-safe. */
export function Field({ label, error, hint, className, ...input }: FieldProps) {
  const id = useId();
  const hasError = Boolean(error?.length);
  const d = ids(id, hasError, hint);

  return (
    <div className={cn("field", className)}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        className="field-input"
        aria-invalid={hasError || undefined}
        aria-describedby={d.describedBy}
        {...input}
      />
      <Message id={id} error={error} hint={hint} />
    </div>
  );
}

export interface TextareaFieldProps extends Omit<ComponentProps<"textarea">, "id">, FieldChrome {}

/** Same chrome as <Field>, for longer text. */
export function TextareaField({ label, error, hint, className, ...input }: TextareaFieldProps) {
  const id = useId();
  const hasError = Boolean(error?.length);
  const d = ids(id, hasError, hint);

  return (
    <div className={cn("field", className)}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <textarea
        id={id}
        className="field-textarea"
        aria-invalid={hasError || undefined}
        aria-describedby={d.describedBy}
        {...input}
      />
      <Message id={id} error={error} hint={hint} />
    </div>
  );
}

export interface SelectFieldProps extends Omit<ComponentProps<"select">, "id">, FieldChrome {
  options: { value: string; label: string }[];
  /** Shown as a disabled first option when no value is chosen yet. */
  placeholder?: string;
}

/** Native <select> (best on phones, fully accessible) with a bare chevron — no box around the icon. */
export function SelectField({ label, error, hint, className, options, placeholder, ...input }: SelectFieldProps) {
  const id = useId();
  const hasError = Boolean(error?.length);
  const d = ids(id, hasError, hint);

  return (
    <div className={cn("field", className)}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          className="field-input appearance-none pr-10"
          aria-invalid={hasError || undefined}
          aria-describedby={d.describedBy}
          {...input}
        >
          {placeholder ? (
            <option value="" disabled={input.required}>
              {placeholder}
            </option>
          ) : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          size={18}
          strokeWidth={1.5}
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted"
        />
      </div>
      <Message id={id} error={error} hint={hint} />
    </div>
  );
}
