"use client";

import { Card } from "@/components/portal/cards";
import { Button } from "@/components/ui/button";

/** A console page failed to load. The shell (sidebar, bar) stays; only this region is replaced. Next 16 passes `retry`. */
export default function ConsoleError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <Card padded className="max-w-[560px]">
      <p className="label-caps">Something went wrong</p>
      <h1 className="mt-3 font-display text-[28px] font-semibold tracking-[-0.022em]">This page didn&apos;t load.</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
        A query failed. Nothing was changed. Try again, and if it keeps happening check the server log for the reference below.
      </p>
      {error.digest && <p className="data-id mt-3 text-[13px] text-muted">Reference: {error.digest}</p>}
      <div className="mt-7">
        <Button onClick={() => retry()}>Try again</Button>
      </div>
    </Card>
  );
}
