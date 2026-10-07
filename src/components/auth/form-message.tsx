import type { ActionResult } from "@/lib/action";

/** Form-level error from a server action (field errors are shown beside their inputs). */
export function FormError({ state }: { state: ActionResult<unknown> | null }) {
  if (!state || state.ok) return null;
  // Field errors already appear under their inputs; only show the top message when it adds something.
  if (state.code === "VALIDATION" && state.fieldErrors && Object.keys(state.fieldErrors).length > 0) return null;
  return (
    <p role="alert" className="form-note" data-tone="error">
      {state.message}
    </p>
  );
}

export function FormSuccess({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="form-note" data-tone="ok">
      {children}
    </p>
  );
}

/** First error message for a field, shaped for <Field error={...}>. */
export function fieldError(state: ActionResult<unknown> | null, name: string): string[] | undefined {
  return state && !state.ok ? state.fieldErrors?.[name] : undefined;
}
