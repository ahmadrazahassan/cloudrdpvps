"use server";

import { z } from "zod";
import { action } from "@/lib/action";
import { cleanSearch, ok, profilesById, searchFilter } from "../db";
import type { PaletteItem } from "@/components/ledger/command-palette";

/**
 * Live matches for the command palette: orders, customers, services and tickets. Runs as the signed-in
 * staff member, so row-level security still decides what can be found; support gets the same lists they can open.
 */
export const adminSearch = action({
  name: "admin-search",
  auth: "staff",
  rateLimit: { limit: 120, window: "1 m" },
  schema: z.object({ q: z.string().trim().min(2).max(64) }),
  async handler({ q }, { supabase }) {
    const term = cleanSearch(q);
    if (term.length < 2) return [] as PaletteItem[];

    const people = searchFilter(["email", "full_name"], term);
    const [orders, customers, services, tickets] = await Promise.all([
      supabase.from("orders").select("id, order_number, plan_name, location_name, user_id").or(`order_number.ilike.%${term}%,plan_name.ilike.%${term}%`).order("created_at", { ascending: false }).limit(4),
      people ? supabase.from("profiles").select("id, email, full_name").eq("role", "customer").or(people).limit(4) : Promise.resolve({ data: [], error: null }),
      supabase
        .from("services")
        .select("id, label, ip, user_id")
        .or(`label.ilike.%${term}%,hostname.ilike.%${term}%${/^\d{1,3}(\.\d{1,3}){3}$/.test(term) ? `,ip.eq.${term}` : ""}`)
        .limit(4),
      supabase.from("tickets").select("id, ticket_no, subject, user_id").or(`subject.ilike.%${term}%${/^\d{1,9}$/.test(term) ? `,ticket_no.eq.${term}` : ""}`).limit(4),
    ]);

    const orderRows = ok(orders, [] as { id: string; order_number: string; plan_name: string; location_name: string; user_id: string }[]);
    const serviceRows = ok(services, [] as { id: string; label: string; ip: string; user_id: string }[]);
    const ticketRows = ok(tickets, [] as { id: string; ticket_no: number; subject: string; user_id: string }[]);
    const owners = await profilesById([...orderRows.map((o) => o.user_id), ...serviceRows.map((s) => s.user_id), ...ticketRows.map((t) => t.user_id)]);
    const who = (id: string) => owners.get(id)?.email;

    const items: PaletteItem[] = [
      ...orderRows.map((o) => ({ id: `o-${o.id}`, group: "Orders", label: o.order_number, hint: `${o.plan_name} · ${o.location_name}`, href: `/admin/orders/${o.id}` })),
      ...ok(customers, [] as { id: string; email: string; full_name: string }[]).map((c) => ({
        id: `c-${c.id}`,
        group: "Customers",
        label: c.full_name.trim() || c.email,
        hint: c.full_name.trim() ? c.email : undefined,
        href: `/admin/customers/${c.id}`,
      })),
      ...serviceRows.map((s) => ({ id: `s-${s.id}`, group: "Services", label: s.label, hint: `${String(s.ip).split("/")[0]}${who(s.user_id) ? ` · ${who(s.user_id)}` : ""}`, href: `/admin/services/${s.id}` })),
      ...ticketRows.map((t) => ({ id: `t-${t.id}`, group: "Tickets", label: `#${t.ticket_no} ${t.subject}`, hint: who(t.user_id), href: `/admin/tickets/${t.id}` })),
    ];
    return items;
  },
});
