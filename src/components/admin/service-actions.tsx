"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { extendService, suspendService, terminateService, unsuspendService, updateCredentials } from "@/lib/admin/actions/services";
import { EXTEND_REASONS, SUSPEND_REASONS } from "@/lib/admin/reasons";
import { formatDate } from "@/lib/format";
import { ActionDialog } from "./action-dialog";

const DAY = 86_400_000;

/** Extend, suspend / restore, change login, terminate. Every one restates the server and records a reason. */
export function ServiceActions({
  serviceId,
  label,
  status,
  expiresAt,
  nowMs,
  termDays,
}: {
  serviceId: string;
  label: string;
  status: string;
  expiresAt: string;
  nowMs: number;
  termDays: number;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const terminated = status === "terminated";

  if (terminated) return <p className="text-[13px] text-muted">This server was terminated. Nothing more can be changed.</p>;

  const base = Math.max(nowMs, Date.parse(expiresAt));

  return (
    <div className="space-y-3">
      <ActionDialog
        trigger={<Button className="w-full">Extend</Button>}
        title={`Extend ${label}?`}
        description="Time is added to whichever is later: now or the current expiry. The customer is told."
        confirmLabel="Extend"
        fields={[
          {
            kind: "select",
            name: "mode",
            label: "How",
            required: true,
            defaultValue: "term",
            options: [
              { value: "term", label: `Add the standard ${termDays} days` },
              { value: "days", label: "Add a number of days" },
              { value: "date", label: "Set an exact expiry" },
            ],
          },
          { kind: "text", name: "days", label: "Days to add", inputMode: "numeric", when: { name: "mode", in: ["days"] } },
          { kind: "datetime", name: "date", label: "New expiry", when: { name: "mode", in: ["date"] } },
          { kind: "select", name: "reason", label: "Reason", options: EXTEND_REASONS, when: { name: "mode", in: ["days", "date"] }, hint: "Anything other than the standard term needs a reason." },
          { kind: "text", name: "detail", label: "Details (optional)", when: { name: "mode", in: ["days", "date"] } },
        ]}
        preview={(v) => {
          const days = v.mode === "term" ? termDays : v.mode === "days" ? Number(v.days) : 0;
          if (v.mode === "date" && v.date) return <>New expiry: <span className="font-semibold text-ink">{formatDate(v.date)}</span></>;
          if (days > 0 && Number.isFinite(days)) return <>New expiry: <span className="font-semibold text-ink">{formatDate(base + days * DAY)}</span></>;
          return null;
        }}
        onSubmit={(v) =>
          extendService({
            serviceId,
            mode: (v.mode || "term") as "term" | "days" | "date",
            days: v.days || undefined,
            date: v.date || undefined,
            reason: (v.reason || undefined) as (typeof EXTEND_REASONS)[number] | undefined,
            detail: v.detail || undefined,
          } as Parameters<typeof extendService>[0])
        }
      />

      {status === "suspended" ? (
        <Button
          variant="secondary"
          className="w-full"
          loading={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await unsuspendService({ serviceId });
              if (!r.ok) setError(r.message);
            })
          }
        >
          Restore access
        </Button>
      ) : (
        <ActionDialog
          trigger={
            <Button variant="secondary" className="w-full">
              Suspend
            </Button>
          }
          title={`Suspend ${label}?`}
          description="The customer sees the server as suspended, with the reason, and can no longer see the login details."
          confirmLabel="Suspend server"
          danger
          fields={[
            { kind: "select", name: "reason", label: "Reason", options: SUSPEND_REASONS, required: true },
            { kind: "text", name: "detail", label: "Details (optional)" },
          ]}
          onSubmit={(v) => suspendService({ serviceId, reason: v.reason as (typeof SUSPEND_REASONS)[number], detail: v.detail })}
        />
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}

      <ActionDialog
        trigger={
          <Button variant="secondary" className="w-full">
            Change login details
          </Button>
        }
        title={`Change the login for ${label}?`}
        description="The new password is encrypted on the server and replaces the old one. The server itself isn't touched — change it on the machine too."
        confirmLabel="Save login"
        fields={[
          { kind: "text", name: "username", label: "Windows username", defaultValue: "Administrator", required: true },
          { kind: "secret", name: "password", label: "New password" },
          { kind: "check", name: "notify", label: "Tell the customer the login changed", defaultValue: "on" },
        ]}
        onSubmit={(v) => updateCredentials({ serviceId, username: v.username ?? "", password: v.password ?? "", notify: v.notify === "on" })}
      />

      <div className="border-t border-line pt-5">
        <p className="label-caps mb-3 !text-bad">Danger zone</p>
        <ActionDialog
          trigger={
            <Button variant="danger" className="w-full">
              Terminate server
            </Button>
          }
          title={`Terminate ${label}?`}
          description="This deletes the stored login, retires the stock item and can't be undone. Type the server's name to confirm."
          confirmLabel="Terminate"
          danger
          fields={[
            { kind: "text", name: "reason", label: "Reason", required: true },
            { kind: "text", name: "typed", label: `Type “${label}” to confirm`, required: true },
          ]}
          onSubmit={(v) => terminateService({ serviceId, reason: v.reason ?? "", typed: v.typed ?? "", label })}
        />
      </div>
    </div>
  );
}
