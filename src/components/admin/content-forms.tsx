"use client";

import { useState, useTransition } from "react";
import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { importBuiltinFaqs, saveAnnouncement } from "@/lib/admin/actions/content";
import { saveSettings } from "@/lib/admin/actions/system";
import { isoToLocalInput, localInputToIso } from "@/lib/admin/datetime";
import type { AnnouncementValue } from "@/lib/admin/queries-system";

type Errors = Record<string, string[]>;

/** One-click: load the site's built-in FAQ answers into the editor. Safe to repeat. */
export function ImportFaqs() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        size="sm"
        loading={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const r = await importBuiltinFaqs({});
            setMsg(r.ok ? { ok: true, text: r.data.added + r.data.updated === 0 ? "Everything is already imported." : `Imported ${r.data.added} new and refreshed ${r.data.updated} placeholder answers.` } : { ok: false, text: r.message });
          })
        }
      >
        Import built-in answers
      </Button>
      {msg && (
        <span role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-[13px] text-ok" : "field-error !mt-0"}>
          {msg.text}
        </span>
      )}
    </div>
  );
}

/** The announcement banner shown above the public site's header. */
export function AnnouncementForm({ initial }: { initial: AnnouncementValue }) {
  const [v, setV] = useState({
    enabled: initial.enabled,
    text: initial.text,
    link: initial.link,
    tone: initial.tone,
    starts: isoToLocalInput(initial.starts_at),
    ends: isoToLocalInput(initial.ends_at),
  });
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setMessage(null);
    start(async () => {
      const r = await saveAnnouncement({ enabled: v.enabled, text: v.text, link: v.link, tone: v.tone, starts_at: localInputToIso(v.starts), ends_at: localInputToIso(v.ends) });
      if (r.ok) setMessage({ ok: true, text: "Saved. The banner is updated on the public site." });
      else {
        setErrors(r.fieldErrors ?? {});
        if (!r.fieldErrors || Object.keys(r.fieldErrors).length === 0) setMessage({ ok: false, text: r.message });
      }
    });
  }

  return (
    <form onSubmit={submit} className="max-w-[640px] space-y-5" noValidate>
      {message && (
        <p role={message.ok ? "status" : "alert"} className="form-note" data-tone={message.ok ? "ok" : "error"}>
          {message.text}
        </p>
      )}
      <label className="check">
        <input type="checkbox" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} />
        <span>Show the banner</span>
      </label>
      <Field label="Text" value={v.text} onChange={(e) => setV({ ...v, text: e.target.value })} maxLength={200} hint="One short line. Shown in small capitals above the header." error={errors.text} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Link (optional)" value={v.link} onChange={(e) => setV({ ...v, link: e.target.value })} placeholder="/pricing" hint="A page on this site, or a full https:// link." error={errors.link} />
        <SelectField label="Style" value={v.tone} onChange={(e) => setV({ ...v, tone: e.target.value as "info" })} options={[{ value: "info", label: "Information (lavender)" }, { value: "warn", label: "Warning (amber)" }]} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Starts (optional)" type="datetime-local" value={v.starts} onChange={(e) => setV({ ...v, starts: e.target.value })} error={errors.starts_at} />
        <Field label="Ends (optional)" type="datetime-local" value={v.ends} onChange={(e) => setV({ ...v, ends: e.target.value })} error={errors.ends_at} />
      </div>
      {v.enabled && v.text && (
        <div className="rounded-card bg-surface-2 px-4 py-3 text-center">
          <p className="label-caps mb-2">Preview</p>
          <p className={`text-[11px] font-medium uppercase tracking-[0.06em] ${v.tone === "warn" ? "text-warn" : "text-lav-700"}`}>{v.text}</p>
        </div>
      )}
      <Button type="submit" loading={pending}>
        Save announcement
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export type SettingField =
  | { name: string; label: string; kind: "text" | "number"; hint?: string; placeholder?: string }
  | { name: string; label: string; kind: "textarea"; hint?: string }
  | { name: string; label: string; kind: "check"; hint?: string };

/** One group of site settings with its own Save button. Values start from what is stored. */
export function SettingsForm({
  group,
  fields,
  initial,
  submitLabel = "Save",
}: {
  group: "general" | "orders" | "operations" | "security";
  fields: SettingField[];
  initial: Record<string, string | boolean>;
  submitLabel?: string;
}) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setMessage(null);
    start(async () => {
      const r = await saveSettings({ group, values: v });
      if (r.ok) {
        // Show what was stored (a typed number is saved as its wa.me link) so the field never disagrees with the site.
        setV((cur) => ({ ...cur, ...Object.fromEntries(Object.entries(r.data.stored).filter(([k]) => typeof cur[k] === "string")) }));
        setMessage({ ok: true, text: "Saved." });
      }
      else {
        setErrors(r.fieldErrors ?? {});
        if (!r.fieldErrors || Object.keys(r.fieldErrors).length === 0) setMessage({ ok: false, text: r.message });
      }
    });
  }

  return (
    <form onSubmit={submit} className="max-w-[640px] space-y-5" noValidate>
      {message && (
        <p role={message.ok ? "status" : "alert"} className="form-note" data-tone={message.ok ? "ok" : "error"}>
          {message.text}
        </p>
      )}
      {fields.map((f) => {
        if (f.kind === "check") {
          return (
            <div key={f.name}>
              <label className="check">
                <input type="checkbox" checked={Boolean(v[f.name])} onChange={(e) => setV({ ...v, [f.name]: e.target.checked })} />
                <span>{f.label}</span>
              </label>
              {f.hint && <p className="field-hint ml-7">{f.hint}</p>}
            </div>
          );
        }
        if (f.kind === "textarea") {
          return <TextareaField key={f.name} label={f.label} value={String(v[f.name] ?? "")} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} hint={f.hint} error={errors[f.name]} className="[&_textarea]:min-h-[96px]" />;
        }
        return (
          <Field
            key={f.name}
            label={f.label}
            value={String(v[f.name] ?? "")}
            onChange={(e) => setV({ ...v, [f.name]: e.target.value })}
            inputMode={f.kind === "number" ? "numeric" : undefined}
            placeholder={f.placeholder}
            hint={f.hint}
            error={errors[f.name]}
            autoComplete="off"
          />
        );
      })}
      <Button type="submit" loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
