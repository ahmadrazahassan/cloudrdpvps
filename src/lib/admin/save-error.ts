import { AppError, fromDbError } from "@/lib/errors";

/**
 * Turn a failed insert / update into an error the form can show next to the right field.
 * A unique-constraint violation (23505) becomes a field message ("That slug is already used");
 * everything else goes through the normal database-error mapping.
 */
export function throwSaveError(error: { code?: string | null; message?: string | null }, uniqueField?: string, uniqueMessage = "That value is already in use."): never {
  if (error.code === "23505" && uniqueField) {
    throw new AppError("VALIDATION", undefined, { fieldErrors: { [uniqueField]: [uniqueMessage] } });
  }
  throw fromDbError(error);
}

/** "one per line" text → trimmed, non-empty lines. */
export const lines = (text: string | undefined): string[] =>
  (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

/** Only the letters we expect in a short code, uppercased. */
export const cleanCode = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
