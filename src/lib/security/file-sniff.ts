import { createHash } from "node:crypto";

/** What we accept as payment proof / ticket attachments. Decided by CONTENT, never by filename or claimed type. */
export const ALLOWED_UPLOAD_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;
export type UploadMime = (typeof ALLOWED_UPLOAD_TYPES)[number];

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const EXT: Record<UploadMime, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

const startsWith = (bytes: Uint8Array, sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);

/** Identify a file by its magic bytes. Returns null for anything we don't accept. */
export function sniffMime(bytes: Uint8Array): UploadMime | null {
  if (bytes.length < 12) return null;
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  // RIFF....WEBP
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  return null;
}

export interface CheckedUpload {
  mime: UploadMime;
  ext: string;
  size: number;
  sha256: string;
}

/**
 * Validate an uploaded file: size cap, real content type, allowed type.
 * Returns the facts the database will record, or null if the file is unusable.
 */
export function checkUpload(bytes: Uint8Array): CheckedUpload | null {
  if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES) return null;
  const mime = sniffMime(bytes);
  if (!mime) return null;
  return { mime, ext: EXT[mime], size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
}
