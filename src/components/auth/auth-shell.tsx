import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Eyebrow } from "@/components/shared/primitives";

const facts = [
  ["Windows on every plan", "Windows Server with full administrator access."],
  ["30-day plans", "Renew from your dashboard before the term ends."],
  ["Manual payment", "Upload proof, we verify it, then deliver your server."],
] as const;

/**
 * Flat two-column frame for every sign-in screen: a hairline-separated statement on the left
 * (desktop only) and the form on the right. No card, no panel — the page colour runs edge to edge.
 */
export function AuthShell({
  eyebrow,
  title,
  lead,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="container-site flex h-16 items-center justify-between">
          <Logo />
          <Link href="/" className="text-sm text-ink-2 hover:text-ink">
            ← Back to site
          </Link>
        </div>
      </header>

      <main id="main" className="flex-1">
        <div className="container-site grid gap-14 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-0 lg:py-24">
          <aside className="hidden pr-16 lg:block" aria-hidden="true">
            <p className="display-h2 max-w-[16ch] text-balance">Windows servers, delivered after we verify your payment.</p>
            <dl className="ruled-wrap mt-12 max-w-[440px]">
              <div className="ruled grid">
                {facts.map(([term, detail]) => (
                  <div key={term} className="py-5 pl-0 pr-4 first:border-t-0">
                    <dt className="text-[15px] font-semibold">{term}</dt>
                    <dd className="mt-1 text-[15px] text-ink-2">{detail}</dd>
                  </div>
                ))}
              </div>
            </dl>
          </aside>

          <div className="lg:border-l lg:border-line lg:pl-16">
            <Eyebrow line={false}>{eyebrow}</Eyebrow>
            <h1 className="mt-4 text-[36px] font-medium leading-[1.06] tracking-[-0.026em] md:text-[44px]">
              {title}
            </h1>
            {lead ? <p className="mt-4 max-w-[44ch] text-[16px] leading-[1.6] text-ink-2">{lead}</p> : null}
            <div className="mt-9">{children}</div>
            {footer ? <div className="mt-9 border-t border-line pt-6 text-[15px] text-ink-2">{footer}</div> : null}
          </div>
        </div>
      </main>
    </div>
  );
}
