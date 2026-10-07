"use client";

import { Eyebrow } from "@/components/shared/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { Error500 } from "@/components/illustrations/state-art";

/**
 * Runtime error inside a public page. Stays inside the site header/footer (this
 * boundary sits below the marketing layout). Next 16 passes `retry`, which
 * re-fetches and re-renders the segment.
 */
export default function MarketingError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <section className="section-pad">
      <div className="container-site max-w-[760px] text-center">
        <div className="mx-auto h-[220px] w-[220px]">
          <Error500 className="h-full w-full blend-multiply" />
        </div>
        <Eyebrow className="justify-center" line={false}>
          ERROR 500
        </Eyebrow>
        <h1 className="display-h2 mt-6 text-balance">Something went wrong on our side.</h1>
        <p className="mx-auto mt-5 max-w-[46ch] text-[17px] leading-[1.65] text-ink-2">
          The page didn&apos;t load properly. Try again, and if it keeps happening, contact us and we&apos;ll look into
          it.
        </p>
        {error.digest && (
          <p className="num-tabular mt-4 text-[13px] text-muted">Reference: {error.digest}</p>
        )}
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={() => retry()}>
            Try again
          </Button>
          <ButtonLink href="/contact" variant="secondary" size="lg">
            Contact us
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
