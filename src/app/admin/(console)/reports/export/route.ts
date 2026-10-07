import { toCsv } from "@/lib/admin/db";
import { logExport } from "@/lib/admin/export-log";
import { csvResponse, exportGuard } from "@/lib/admin/export-guard";
import { getReportData } from "@/lib/admin/queries-system";
import { isRange, rangeBounds } from "@/lib/admin/queries";
import { now } from "@/lib/clock";

export const dynamic = "force-dynamic";

const usd = (c: number) => (c / 100).toFixed(2);

/** Orders or paid invoices for a date range as CSV. The export is recorded in the audit log. */
export async function GET(request: Request) {
  const guard = await exportGuard("reports");
  if ("response" in guard) return guard.response;

  const sp = new URL(request.url).searchParams;
  const range = isRange(sp.get("range") ?? undefined) ? (sp.get("range") as "today" | "7d" | "30d" | "90d") : "30d";
  const kind = sp.get("kind") === "invoices" ? "invoices" : "orders";
  const b = rangeBounds(range, now());
  const data = await getReportData(b.from, b.to);

  let body: string;
  let rows: number;
  if (kind === "invoices") {
    const orderById = new Map(data.orders.map((o) => [o.id, o]));
    rows = data.invoices.length;
    body = toCsv(
      ["issued_utc", "status", "order_number", "product", "plan", "location", "total_usd", "discount_usd"],
      data.invoices.map((i) => {
        const o = orderById.get(i.order_id);
        return [i.issued_at, i.status, o?.order_number ?? "", o?.product ?? "", o?.plan_name ?? "", o?.location_name ?? "", usd(i.total_cents), usd(i.discount_cents)];
      }),
    );
  } else {
    rows = data.orders.length;
    body = toCsv(
      ["created_utc", "order_number", "type", "status", "product", "plan", "location", "total_usd", "discount_usd", "completed_utc"],
      data.orders.map((o) => [o.created_at, o.order_number, o.type, o.status, o.product, o.plan_name, o.location_name, usd(o.total_cents), usd(o.discount_cents), o.completed_at ?? ""]),
    );
  }
  await logExport(guard.user.id, `report_${kind}`, rows, { range });
  return csvResponse(body, `${kind}-${range}-${new Date().toISOString().slice(0, 10)}.csv`);
}
