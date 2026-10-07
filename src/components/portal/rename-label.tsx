"use client";

import { Check, Pencil, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { renameService } from "@/app/(portal)/dashboard/services/actions";

/** Click the pencil to rename a server inline. Enter saves, Escape cancels. */
export function RenameLabel({ serviceId, label }: { serviceId: string; label: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  const [saved, setSaved] = useState(label);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function save() {
    const next = value.trim();
    if (next === saved) return setEditing(false);
    setError(null);
    start(async () => {
      const result = await renameService({ serviceId, label: next });
      if (result.ok) {
        setSaved(result.data.label);
        setValue(result.data.label);
        setEditing(false);
      } else {
        setError(result.fieldErrors?.label?.[0] ?? result.message);
      }
    });
  }

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-2">
        <span>{saved}</span>
        <button
          type="button"
          aria-label="Rename this server"
          onClick={() => {
            setEditing(true);
            requestAnimationFrame(() => input.current?.select());
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-btn text-muted hover:bg-black/[0.05] hover:text-ink"
        >
          <Pencil size={16} strokeWidth={1.5} aria-hidden />
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex items-center gap-2">
        <input
          ref={input}
          value={value}
          autoFocus
          maxLength={60}
          aria-label="Server name"
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setValue(saved);
              setEditing(false);
              setError(null);
            }
          }}
          className="field-input !h-11 !w-[min(320px,60vw)] !text-[20px] !font-semibold"
        />
        <button
          type="button"
          aria-label="Save name"
          onClick={save}
          disabled={pending}
          className="inline-flex h-9 w-9 items-center justify-center rounded-btn text-ok hover:bg-black/[0.05]"
        >
          <Check size={18} strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Cancel renaming"
          onClick={() => {
            setValue(saved);
            setEditing(false);
            setError(null);
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-btn text-muted hover:bg-black/[0.05]"
        >
          <X size={18} strokeWidth={1.5} aria-hidden />
        </button>
      </span>
      {error && (
        <span role="alert" className="field-error">
          {error}
        </span>
      )}
    </span>
  );
}
