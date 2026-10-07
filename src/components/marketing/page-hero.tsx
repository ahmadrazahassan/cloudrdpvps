import type { ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "@/components/marketing/breadcrumbs";
import { Eyebrow } from "@/components/shared/primitives";
import { cn } from "@/lib/utils";

/**
 * Opening block of every inner page: breadcrumbs, eyebrow, H1, lede, actions
 * and an optional illustration on the right. Flat — it sits on the page with no
 * panel behind it. `align="center"` centres everything (and leaves no room for art).
 */
export function PageHero({
  crumbs,
  eyebrow,
  title,
  lede,
  actions,
  art,
  meta,
  className,
  align = "start",
}: {
  crumbs: Crumb[];
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  art?: ReactNode;
  /** Small line under the actions (e.g. "From $6 / 30 days"). */
  meta?: ReactNode;
  className?: string;
  align?: "start" | "center";
}) {
  const center = align === "center";
  return (
    <section className={cn("pt-8 pb-14 md:pt-10 md:pb-20", className)}>
      <div className="container-site">
        <Breadcrumbs items={crumbs} align={center ? "center" : "start"} />
        <div
          className={cn(
            "mt-10 grid items-center gap-10 md:mt-14",
            art && !center && "lg:grid-cols-[1.15fr_0.85fr] lg:gap-16",
          )}
        >
          <div className={cn(center && "text-center")}>
            {center ? <p className="label-caps">{eyebrow}</p> : <Eyebrow line={false}>{eyebrow}</Eyebrow>}
            <h1 className={cn("display-h1 mt-6", center ? "mx-auto max-w-[20ch]" : "max-w-[18ch]")}>{title}</h1>
            {lede && (
              <p className={cn("mt-6 text-[17px] leading-[1.65] text-ink-2 md:text-lg", center ? "mx-auto max-w-[62ch]" : "max-w-[58ch]")}>
                {lede}
              </p>
            )}
            {actions && <div className={cn("mt-9 flex flex-wrap items-center gap-3", center && "justify-center")}>{actions}</div>}
            {meta && <div className="mt-6">{meta}</div>}
          </div>
          {art && <div className="mx-auto w-full max-w-[460px] lg:max-w-none">{art}</div>}
        </div>
      </div>
    </section>
  );
}
