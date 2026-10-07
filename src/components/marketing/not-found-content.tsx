import { Eyebrow } from "@/components/shared/primitives";
import { SiteImage } from "@/components/shared/site-image";
import { ButtonLink } from "@/components/ui/button";

export function NotFoundContent() {
  return (
    <section className="section-pad">
      <div className="container-site max-w-[760px] text-center">
        <div className="mx-auto h-[220px] w-[220px]">
          <SiteImage name="error-404" className="h-full w-full" />
        </div>
        <Eyebrow className="justify-center" line={false}>
          ERROR 404
        </Eyebrow>
        <h1 className="display-h2 mt-6 text-balance">This page has been unplugged.</h1>
        <p className="mx-auto mt-5 max-w-[44ch] text-[17px] leading-[1.65] text-ink-2">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/" size="lg">
            Back to homepage
          </ButtonLink>
          <ButtonLink href="/pricing" variant="secondary" size="lg">
            View plans
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
