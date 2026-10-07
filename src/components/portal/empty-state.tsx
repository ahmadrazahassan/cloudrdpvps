import type { ReactNode } from "react";
import { Card } from "@/components/portal/cards";
import { SiteImage } from "@/components/shared/site-image";
import type { ImageKey } from "@/content/images";
import { cn } from "@/lib/utils";

/**
 * Illustration + title + one line + an action, centred. On its own it sits in a card; inside a card that
 * already exists (a list's empty result), pass `bare` so there is no card in a card.
 */
export function EmptyState({
  image,
  title,
  body,
  action,
  className,
  bare = false,
}: {
  image: ImageKey;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
  bare?: boolean;
}) {
  const inner = (
    <div className={cn("mx-auto max-w-[420px] px-6 py-12 text-center", className)}>
      <div className="mx-auto h-[150px] w-[150px]">
        <SiteImage name={image} className="h-full w-full" sizes="150px" />
      </div>
      <h2 className="mt-5 font-display text-[21px] font-semibold tracking-[-0.018em] text-ink">{title}</h2>
      {body && <p className="mt-2 text-[15px] leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
  return bare ? inner : <Card>{inner}</Card>;
}
