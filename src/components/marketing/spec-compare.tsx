import Link from "next/link";
import { productPages } from "@/content/pages";
import { minPriceCents, specRanges, type Catalog, type ProductType } from "@/lib/catalog";
import { cn, formatPort, formatUsd } from "@/lib/utils";

const range = (r: readonly [number, number], unit = "") =>
  r[0] === r[1] ? `${r[0]}${unit}` : `${r[0]}–${r[1]}${unit}`;

const PRODUCTS: ProductType[] = ["rdp", "vps"];

/**
 * Windows RDP and Windows VPS side by side, computed from the live plan ladders.
 * Open table with hairlines; the product you're reading is marked with a lavender rule.
 */
export function SpecCompare({ catalog, current }: { catalog: Catalog; current?: ProductType }) {
  const cols = PRODUCTS.map((p) => {
    const s = specRanges(catalog, p);
    const from = minPriceCents(catalog, p);
    return {
      product: p,
      label: productPages[p].label,
      path: productPages[p].path,
      chooseIf: productPages[p].chooseIf,
      rows: [
        from !== null ? formatUsd(from) + " / 30 days" : "—",
        range(s.vcpu),
        range(s.ramGb, " GB"),
        range(s.storageGb, " GB"),
        range(s.bandwidthTb, " TB"),
        `${formatPort(s.portMbps[0])} – ${formatPort(s.portMbps[1])}`,
      ],
    };
  });
  const labels = ["Starting at", "vCPU", "RAM", "NVMe storage", "Bandwidth", "Port speed"];

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[560px] text-left">
        <thead>
          <tr>
            <td className="w-[28%]" />
            {cols.map((c) => (
              <th
                key={c.product}
                scope="col"
                className={cn(
                  "border-b-2 pb-4 pr-6 align-bottom text-[19px] font-semibold tracking-[-0.012em] text-ink",
                  c.product === current ? "border-lav-600" : "border-line-2",
                )}
              >
                <Link href={c.path} className="transition-colors hover:text-lav-700">
                  {c.label}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="num-tabular">
          {labels.map((label, i) => (
            <tr key={label} className="border-b border-line">
              <th scope="row" className="label-caps py-4 pr-4 font-normal">
                {label}
              </th>
              {cols.map((c) => (
                <td key={c.product} className="py-4 pr-6 text-[15px] font-medium text-ink">
                  {c.rows[i]}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <th scope="row" className="label-caps py-5 pr-4 align-top font-normal">
              Choose it if
            </th>
            {cols.map((c) => (
              <td key={c.product} className="max-w-[28ch] py-5 pr-6 align-top text-[15px] leading-relaxed text-ink-2">
                {c.chooseIf}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
