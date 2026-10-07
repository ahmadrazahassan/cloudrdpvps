"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { addInventoryItem, importInventory, retireInventoryItem } from "@/lib/admin/actions/inventory";
import { ActionDialog } from "./action-dialog";

interface Option {
  value: string;
  label: string;
}

export function AddInventory({ locations, plans }: { locations: Option[]; plans: Option[] }) {
  return (
    <ActionDialog
      size="lg"
      trigger={<Button size="sm">Add server</Button>}
      title="Add a server to stock"
      description="Stock servers can be delivered to customers in one click. The password is encrypted before it is stored and is never shown again except inside the customer's dashboard."
      confirmLabel="Add to stock"
      fields={[
        { kind: "select", name: "product", label: "Product", half: true, required: true, options: [{ value: "rdp", label: "RDP" }, { value: "vps", label: "VPS" }] },
        { kind: "select", name: "location_id", label: "Location", half: true, required: true, options: locations },
        { kind: "select", name: "plan_id", label: "Plan (optional)", options: [{ value: "", label: "Any plan" }, ...plans], hint: "Leave on “Any plan” if this server can fill any order for its product and location." },
        { kind: "text", name: "ip", label: "IP address", half: true, required: true, placeholder: "203.0.113.10" },
        { kind: "text", name: "rdp_port", label: "RDP port", half: true, inputMode: "numeric", defaultValue: "3389" },
        { kind: "text", name: "username", label: "Windows username", half: true, defaultValue: "Administrator" },
        { kind: "secret", name: "password", label: "Windows password", half: true },
        { kind: "text", name: "supplier", label: "Supplier (optional)", half: true },
        { kind: "text", name: "supplier_ref", label: "Supplier reference (optional)", half: true },
        { kind: "text", name: "cost", label: "Your cost, USD (optional)", half: true, inputMode: "decimal" },
        { kind: "text", name: "supplier_expires_at", label: "Supplier expiry (optional)", half: true, placeholder: "2026-12-31" },
        { kind: "textarea", name: "notes", label: "Notes (optional)" },
      ]}
      onSubmit={(v) =>
        addInventoryItem({
          product: v.product as "rdp",
          location_id: v.location_id ?? "",
          plan_id: v.plan_id ?? "",
          ip: v.ip ?? "",
          rdp_port: v.rdp_port,
          username: v.username ?? "",
          password: v.password ?? "",
          supplier: v.supplier,
          supplier_ref: v.supplier_ref,
          cost: v.cost ?? "",
          supplier_expires_at: v.supplier_expires_at ?? "",
          notes: v.notes,
        })
      }
    />
  );
}

export function RetireItem({ id, ip }: { id: string; ip: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <ActionDialog
        trigger={
          <Button size="sm" variant="ghost" loading={pending}>
            Retire
          </Button>
        }
        title={`Retire ${ip}?`}
        description="It is taken out of stock and can't be delivered to a customer. Use this for servers you no longer have."
        confirmLabel="Retire server"
        danger
        onSubmit={async () => {
          const r = await retireInventoryItem({ id });
          if (!r.ok) setError(r.message);
          return r;
        }}
        onDone={() => start(() => undefined)}
      />
      {error && <span className="field-error">{error}</span>}
    </span>
  );
}

type CheckResult = { checked: true; valid: number; problems: { line: number; message: string }[] };

const SAMPLE = "product,location,ip,port,username,password,supplier,supplier_ref,cost_usd,supplier_expires\nrdp,germany,203.0.113.10,3389,Administrator,ChangeMe-12345,Acme Hosting,ORD-1001,9.50,2026-12-31";

/** Paste a CSV, check it line by line, then import the valid rows. Nothing is stored until you press Import. */
export function ImportInventory() {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const reset = () => {
    setCsv("");
    setResult(null);
    setError(null);
    setDone(null);
  };

  function run(commit: boolean) {
    setError(null);
    start(async () => {
      const r = await importInventory({ csv, commit });
      if (!r.ok) return setError(r.fieldErrors?.csv?.[0] ?? r.message);
      if (r.data.checked) setResult(r.data);
      else {
        setDone(`Imported ${r.data.imported} server${r.data.imported === 1 ? "" : "s"}.`);
        setResult(null);
        setCsv("");
      }
    });
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        if (o) reset();
        setOpen(o);
      }}
    >
      <Dialog.Trigger asChild>
        <Button size="sm" variant="secondary">
          Import CSV
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-ink/30 data-[state=open]:animate-[fade-in_0.2s_ease-out]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[70] max-h-[92dvh] w-[calc(100%-32px)] max-w-[720px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-panel border border-black/[0.06] bg-surface p-7 shadow-2 data-[state=open]:animate-[fade-in_0.15s_ease-out]">
          <Dialog.Title className="text-[20px] font-semibold tracking-[-0.016em] text-ink">Import servers from CSV</Dialog.Title>
          <Dialog.Description className="mt-2.5 text-[14.5px] leading-relaxed text-ink-2">
            Columns: product, location (the location&apos;s slug, e.g. germany), ip, port, username, password, supplier, supplier_ref, cost_usd, supplier_expires. Only product, location, ip, username and password are required. IPs already in stock are skipped.
          </Dialog.Description>

          <div className="mt-5 space-y-4">
            <div className="field">
              <label htmlFor="csv" className="field-label">
                CSV
              </label>
              <textarea id="csv" value={csv} onChange={(e) => (setCsv(e.target.value), setResult(null), setDone(null))} placeholder={SAMPLE} spellCheck={false} className="field-textarea data-id !min-h-[190px] !text-[13px]" />
            </div>
            {error && (
              <p role="alert" className="form-note" data-tone="error">
                {error}
              </p>
            )}
            {done && (
              <p role="status" className="form-note" data-tone="ok">
                {done}
              </p>
            )}
            {result && (
              <div className="space-y-2">
                <p className="text-[14px] text-ink">
                  <span className="font-semibold">{result.valid}</span> server{result.valid === 1 ? "" : "s"} ready to import
                  {result.problems.length > 0 && <>, <span className="font-semibold text-warn">{result.problems.length}</span> line{result.problems.length === 1 ? "" : "s"} with a problem</>}.
                </p>
                {result.problems.length > 0 && (
                  <ul className="max-h-[160px] divide-y divide-line overflow-y-auto rounded-card border border-line px-3 text-[13px]">
                    {result.problems.map((p) => (
                      <li key={`${p.line}-${p.message}`} className="py-1.5">
                        <span className="num-tabular mr-2 font-semibold text-ink">Line {p.line}</span>
                        <span className="text-ink-2">{p.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <Dialog.Close asChild>
                <Button variant="secondary" disabled={pending}>
                  Close
                </Button>
              </Dialog.Close>
              <Button variant="secondary" onClick={() => run(false)} loading={pending} disabled={!csv.trim()}>
                Check
              </Button>
              <Button onClick={() => run(true)} loading={pending} disabled={!result || result.valid === 0}>
                Import {result?.valid ?? ""}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
