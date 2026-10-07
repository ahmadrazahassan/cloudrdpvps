import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Title block at the top of every portal page: Inter Tight title, muted line, actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-8", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.024em] text-ink md:text-[32px]">
          {title}
        </h1>
        {description && <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

/** A titled section inside a portal page, separated from the previous one by a hairline. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("border-t border-line py-9 first:border-t-0 first:pt-0", className)}>
      {(title || actions) && (
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            {title && <h2 className="text-[19px] font-semibold tracking-[-0.014em] text-ink">{title}</h2>}
            {description && <p className="mt-1 text-[14px] text-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
