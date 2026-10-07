import type { Metadata } from "next";
import { AddStaff, StaffRow } from "@/components/admin/editors";
import { AdminHeader, Ago } from "@/components/admin/parts";
import { DataTable, type Column } from "@/components/admin/data-table";
import { AdminBadge } from "@/components/admin/status";
import { requireAdminConsole } from "@/lib/admin/guard";
import { getStaffMfa, getTeam } from "@/lib/admin/queries-system";
import { now } from "@/lib/clock";
import type { Tables } from "@/types/database";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const me = await requireAdminConsole();
  const nowMs = now();
  const team = await getTeam();
  const mfa = await getStaffMfa(team.map((t) => t.id));

  const columns: Column<Tables<"profiles">>[] = [
    {
      key: "name",
      header: "Person",
      cell: (p) => (
        <span className="block min-w-0">
          <span className="block max-w-[260px] truncate font-semibold text-ink">
            {p.full_name.trim() || p.email}
            {p.id === me.id && <span className="ml-2 text-[11px] font-medium uppercase tracking-[0.06em] text-lav-700">You</span>}
          </span>
          {p.full_name.trim() && <span className="block max-w-[260px] truncate text-[12px] text-muted">{p.email}</span>}
        </span>
      ),
    },
    { key: "role", header: "Role", cell: (p) => <span className="font-medium capitalize">{p.role}</span> },
    { key: "status", header: "Status", cell: (p) => <AdminBadge kind="account" status={p.status} /> },
    {
      key: "mfa",
      header: "Two-step",
      hide: "md",
      cell: (p) => (mfa.has(p.id) ? mfa.get(p.id) ? <span className="text-ok">On</span> : <span className="text-warn">Not set up</span> : <span className="text-muted">Unknown</span>),
    },
    { key: "seen", header: "Last active", hide: "lg", cell: (p) => (p.last_seen_at ? <Ago value={p.last_seen_at} nowMs={nowMs} className="text-muted" /> : <span className="text-muted">—</span>) },
    { key: "actions", header: "Actions", srOnlyHeader: true, align: "right", cell: (p) => <StaffRow id={p.id} name={p.full_name.trim() || p.email} role={p.role as "support" | "admin"} active={p.status === "active"} isMe={p.id === me.id} /> },
  ];

  return (
    <>
      <AdminHeader
        title="Team"
        description="Everyone with console access. Admins can do everything; support can answer tickets and read orders, but can't approve payments, see revenue or reveal logins. You can't change your own role, and the last admin can't be removed."
        actions={<AddStaff />}
      />
      <DataTable rows={team} columns={columns} rowKey={(p) => p.id} label="Team members" empty="No staff yet." />
      {mfa.size === 0 && <p className="mt-5 text-[13px] text-muted">Two-step status needs the Supabase service-role key on the server; it isn&apos;t configured here.</p>}
    </>
  );
}
