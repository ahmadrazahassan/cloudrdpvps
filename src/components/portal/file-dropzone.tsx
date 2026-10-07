"use client";

import { FileText, Upload, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const ACCEPT = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const MAX_BYTES = 5 * 1024 * 1024;

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

interface Entry {
  file: File;
  /** Object URL for an image thumbnail (revoked when the entry goes away). */
  preview: string | null;
}

/**
 * Drag-and-drop or click-to-choose file input that still submits as an ordinary
 * `<input type="file" name={name}>` inside the surrounding <form>.
 *
 * The checks here (type, size) are only for fast feedback — the server re-checks the
 * real file contents and size before anything is stored.
 */
export function FileDropzone({
  name,
  label,
  hint = "PNG, JPG, WebP or PDF, up to 5 MB.",
  multiple = false,
  maxFiles = 1,
  error,
  required,
}: {
  name: string;
  label: string;
  hint?: string;
  multiple?: boolean;
  maxFiles?: number;
  error?: string;
  required?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Whatever is still shown when the component goes away gets its preview URLs released.
  const live = useRef<Entry[]>([]);
  useEffect(() => () => live.current.forEach((e) => e.preview && URL.revokeObjectURL(e.preview)), []);

  /** Replace the chosen files, and push them back into the real input so the form submits them. */
  function commit(next: Entry[]) {
    for (const old of live.current) {
      if (old.preview && !next.includes(old)) URL.revokeObjectURL(old.preview);
    }
    live.current = next;
    setEntries(next);
    if (!input.current) return;
    const dt = new DataTransfer();
    next.forEach((e) => dt.items.add(e.file));
    input.current.files = dt.files;
  }

  function accept(incoming: File[]) {
    setProblem(null);
    const good: Entry[] = [];
    for (const f of incoming) {
      if (!ACCEPT.includes(f.type)) {
        setProblem(`“${f.name}” isn't a PNG, JPG, WebP or PDF.`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        setProblem(`“${f.name}” is larger than 5 MB.`);
        continue;
      }
      good.push({ file: f, preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : null });
    }
    if (good.length === 0) return;
    const merged = multiple ? [...live.current, ...good] : good.slice(0, 1);
    if (merged.length > maxFiles) {
      setProblem(`You can attach up to ${maxFiles} file${maxFiles === 1 ? "" : "s"}.`);
      // Release thumbnails for the files that didn't fit.
      merged.slice(maxFiles).forEach((e) => e.preview && URL.revokeObjectURL(e.preview));
    }
    commit(merged.slice(0, maxFiles));
  }

  const shown = problem ?? error;

  return (
    <div>
      <p className="field-label" id={`${id}-label`}>
        {label}
      </p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "rounded-btn border border-dashed px-5 py-7 text-center transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-lav-500",
          dragging ? "border-lav-600" : shown ? "border-bad" : "border-line-2 hover:border-muted",
        )}
      >
        <Upload size={22} strokeWidth={1.5} aria-hidden className="mx-auto text-lav-600" />
        <p className="mt-3 text-[15px] text-ink-2">
          <label htmlFor={id} className="cursor-pointer font-semibold text-lav-700 underline decoration-lav-300 underline-offset-4 hover:decoration-lav-700">
            Choose {multiple ? "files" : "a file"}
          </label>{" "}
          or drag {multiple ? "them" : "it"} here
        </p>
        <p className="mt-1 text-[13px] text-muted">{hint}</p>
        <input
          ref={input}
          id={id}
          name={name}
          type="file"
          accept={ACCEPT.join(",")}
          multiple={multiple}
          required={required && entries.length === 0}
          aria-labelledby={`${id}-label`}
          aria-describedby={shown ? `${id}-error` : undefined}
          className="sr-only"
          onChange={(e) => accept(Array.from(e.target.files ?? []))}
        />
      </div>

      {entries.length > 0 && (
        <ul className="mt-3 border-t border-line">
          {entries.map((e, i) => (
            <li key={`${e.file.name}:${e.file.size}:${e.file.lastModified}`} className="flex items-center gap-3 border-b border-line py-2.5">
              {e.preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- a local blob preview; next/image can't optimise it
                <img src={e.preview} alt="" className="h-10 w-10 shrink-0 rounded-[6px] object-cover" />
              ) : (
                <FileText size={22} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-ink">{e.file.name}</span>
                <span className="num-tabular block text-[12px] text-muted">{kb(e.file.size)}</span>
              </span>
              <button
                type="button"
                aria-label={`Remove ${e.file.name}`}
                onClick={() => commit(entries.filter((_, j) => j !== i))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-btn text-muted hover:bg-black/[0.05] hover:text-ink"
              >
                <X size={16} strokeWidth={1.5} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {shown && (
        <p id={`${id}-error`} role="alert" className="field-error">
          {shown}
        </p>
      )}
    </div>
  );
}
