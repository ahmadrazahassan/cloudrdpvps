"use client";

import { useState, useTransition } from "react";
import { assignTicket, setTicketFields } from "@/lib/admin/actions/support";

const STATUS = [
  { value: "open", label: "Needs reply" },
  { value: "awaiting_customer", label: "Waiting on customer" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];
const PRIORITY = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const selectCls =
  "h-10 w-full appearance-none rounded-btn border border-line-2 bg-transparent px-3 text-[14px] text-ink outline-none transition-colors hover:border-muted focus:border-lav-600 focus:outline-2 focus:outline-offset-1 focus:outline-lav-500 disabled:opacity-60";

/** Status, priority and assignee. Each change saves immediately; the row of controls shows a one-line error if it can't. */
export function TicketControls({
  ticketId,
  status,
  priority,
  assignedTo,
  staff,
  me,
}: {
  ticketId: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  staff: { id: string; name: string }[];
  me: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.message ?? "That didn't save.");
    });

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="t-status" className="label-caps mb-1.5 block">
          Status
        </label>
        <select id="t-status" className={selectCls} defaultValue={status} disabled={pending} onChange={(e) => run(() => setTicketFields({ ticketId, status: e.target.value as "open" }))}>
          {STATUS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="t-priority" className="label-caps mb-1.5 block">
          Priority
        </label>
        <select id="t-priority" className={selectCls} defaultValue={priority} disabled={pending} onChange={(e) => run(() => setTicketFields({ ticketId, priority: e.target.value as "normal" }))}>
          {PRIORITY.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="t-assignee" className="label-caps mb-1.5 block">
          Assigned to
        </label>
        <select id="t-assignee" className={selectCls} defaultValue={assignedTo ?? ""} disabled={pending} onChange={(e) => run(() => assignTicket({ ticketId, assignee: e.target.value }))}>
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.id === me ? " (you)" : ""}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
