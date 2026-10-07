"use server";

import { z } from "zod";
import { action } from "@/lib/action";
import type { PaletteItem } from "@/components/ledger/command-palette";

/** Strip the characters that carry meaning inside a PostgREST `or(...)` filter. */
const clean = (q: string) => q.replace(/[,()*%\\"'`;:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 64);

/**
 * Live matches for the dashboard's command palette: the signed-in customer's own servers, orders and tickets.
 * It runs as the customer, so row-level security guarantees they can only ever find their own records.
 */
export const portalSearch = action({
  name: "portal-search",
  auth: "user",
  rateLimit: { limit: 120, window: "1 m" },
  schema: z.object({ q: z.string().trim().min(2).max(64) }),
  async handler({ q }, { supabase }) {
    const term = clean(q);
    if (term.length < 2) return [] as PaletteItem[];
    const ipExact = /^\d{1,3}(\.\d{1,3}){3}$/.test(term) ? `,ip.eq.${term}` : "";

    const [services, orders, tickets] = await Promise.all([
      supabase.from("services").select("id, label, ip, status").or(`label.ilike.%${term}%,hostname.ilike.%${term}%${ipExact}`).neq("status", "terminated").limit(5),
      supabase.from("orders").select("id, order_number, plan_name, status").or(`order_number.ilike.%${term}%,plan_name.ilike.%${term}%`).order("created_at", { ascending: false }).limit(5),
      supabase.from("tickets").select("id, ticket_no, subject").or(`subject.ilike.%${term}%${/^\d{1,9}$/.test(term) ? `,ticket_no.eq.${term}` : ""}`).limit(4),
    ]);

    return [
      ...(services.data ?? []).map((s) => ({ id: `s-${s.id}`, group: "Servers", label: s.label, hint: String(s.ip).split("/")[0], href: `/dashboard/services/${s.id}` })),
      ...(orders.data ?? []).map((o) => ({ id: `o-${o.id}`, group: "Orders", label: o.order_number, hint: o.plan_name, href: `/dashboard/orders/${o.id}` })),
      ...(tickets.data ?? []).map((t) => ({ id: `t-${t.id}`, group: "Tickets", label: `#${t.ticket_no} ${t.subject}`, href: `/dashboard/tickets/${t.id}` })),
    ] satisfies PaletteItem[];
  },
});
