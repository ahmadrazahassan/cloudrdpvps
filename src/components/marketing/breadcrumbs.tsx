import Link from "next/link";
import { JsonLd } from "@/components/shared/json-ld";
import { site } from "@/content/site";

export interface Crumb {
  label: string;
  /** Omit on the current page. */
  href?: string;
}

/**
 * Plain-text trail above an inner page's heading, plus the matching
 * BreadcrumbList structured data. Home is implied as the first item.
 */
export function Breadcrumbs({ items, align = "start" }: { items: Crumb[]; align?: "start" | "center" }) {
  const trail: Crumb[] = [{ label: "Home", href: "/" }, ...items];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: trail.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.label,
            ...(c.href ? { item: `${site.url}${c.href === "/" ? "" : c.href}` } : {}),
          })),
        }}
      />
      <nav aria-label="Breadcrumb">
        <ol className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted${align === "center" ? " justify-center" : ""}`}>
          {trail.map((c, i) => {
            const last = i === trail.length - 1;
            return (
              <li key={c.label} className="flex items-center gap-2">
                {c.href && !last ? (
                  <Link href={c.href} className="transition-colors hover:text-ink">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined} className={last ? "text-ink-2" : undefined}>
                    {c.label}
                  </span>
                )}
                {!last && (
                  <span aria-hidden className="text-line-2">
                    /
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
