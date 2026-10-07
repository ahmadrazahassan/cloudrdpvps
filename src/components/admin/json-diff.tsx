import type { Json } from "@/types/database";

const show = (v: unknown) => (v === undefined ? "—" : typeof v === "string" ? v : JSON.stringify(v));

/**
 * Before / after for one audit event: one row per field that differs (or exists on one side only).
 * Secrets never appear here because the database strips them before it writes the row.
 */
export function JsonDiff({ before, after }: { before: Json | null; after: Json | null }) {
  const a = (before && typeof before === "object" && !Array.isArray(before) ? before : {}) as Record<string, unknown>;
  const b = (after && typeof after === "object" && !Array.isArray(after) ? after : {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const rows = keys.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  if (rows.length === 0) return <p className="text-[13px] text-muted">No field-level changes were recorded.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-line-2">
            <th scope="col" className="label-caps h-8 pr-4 font-medium">Field</th>
            <th scope="col" className="label-caps h-8 pr-4 font-medium">Before</th>
            <th scope="col" className="label-caps h-8 font-medium">After</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((k) => (
            <tr key={k} className="border-b border-line align-top">
              <th scope="row" className="py-1.5 pr-4 text-left font-medium text-ink">{k}</th>
              <td className="max-w-[260px] break-words py-1.5 pr-4 text-bad">{show(a[k])}</td>
              <td className="max-w-[260px] break-words py-1.5 text-ok">{show(b[k])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
