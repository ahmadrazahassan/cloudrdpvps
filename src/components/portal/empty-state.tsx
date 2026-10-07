import type { ReactNode } from "react";
import { SiteImage } from "@/components/shared/site-image";
import type { ImageKey } from "@/content/images";
import { cn } from "@/lib/utils";

/** Illustration + title + one line + an action, centred on the page. No panel behind it. */
export function EmptyState({
  image,
  title,
  body,
  action,
  className,
}: {
  image: ImageKey;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-[420px] py-14 text-center", className)}>
      <div className="mx-auto h-[170px] w-[170px]">
        <SiteImage name={image} className="h-full w-full" sizes="170px" />
      </div>
      <h2 className="mt-6 text-[22px] font-semibold tracking-[-0.015em] text-ink">{title}</h2>
      {body && <p className="mt-2 text-[15px] leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-7 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}
