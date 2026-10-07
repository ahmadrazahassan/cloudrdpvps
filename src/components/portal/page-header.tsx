import type { ReactNode } from "react";
import { Card, CardHeader } from "@/components/portal/cards";
import { cn } from "@/lib/utils";

/** Title block at the top of every portal page: Inter Tight title, one muted line, actions on the right. */
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
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-6 pt-1 md:pb-7", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.026em] text-ink md:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-[62ch] text-[15px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

/**
 * A titled card inside a portal page. Stack several with `space-y-5`.
 * `split` puts the title and its description in a left column and the content on the right (settings screens).
 */
export function Section({
  title,
  description,
  actions,
  children,
  className,
  id,
  split = false,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  split?: boolean;
}) {
  if (split && title) {
    return (
      <Card id={id} className={cn("grid lg:grid-cols-[300px_minmax(0,1fr)]", className)}>
        <div className="border-b border-line p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <h2 className="font-display text-[17px] font-semibold leading-snug tracking-[-0.016em] text-ink">{title}</h2>
          {description && <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{description}</p>}
          {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
        </div>
        <div className="min-w-0 p-5 sm:p-6">{children}</div>
      </Card>
    );
  }
  return (
    <Card id={id} className={className}>
      {(title || actions) && <CardHeader title={title} description={description} action={actions} divided />}
      <div className="p-5 sm:p-6">{children}</div>
    </Card>
  );
}
