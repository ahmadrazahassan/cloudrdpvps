import Link from "next/link";
import { PageHero } from "@/components/marketing/page-hero";
import { legalDocs, legalUpdated, legalUpdatedIso, type LegalDoc } from "@/content/legal";

/** One legal document: sticky table of contents on the left, the text on the right. */
export function LegalDocument({ doc }: { doc: LegalDoc }) {
  return (
    <>
      <PageHero
        crumbs={[{ label: "Legal", href: "/legal" }, { label: doc.title }]}
        eyebrow="LEGAL"
        title={doc.title}
        lede={doc.summary}
        meta={
          <p className="label-caps">
            Last updated <time dateTime={legalUpdatedIso}>{legalUpdated}</time>
          </p>
        }
        className="pb-10 md:pb-14"
      />

      <div className="container-site border-t border-line pb-24 pt-12 md:pt-16">
        <div className="grid gap-12 lg:grid-cols-[260px_1fr] lg:gap-20">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <nav aria-label={`${doc.title} contents`}>
              <p className="label-caps">On this page</p>
              <ol className="mt-4 space-y-2 border-l border-line">
                {doc.sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="-ml-px block border-l border-transparent py-0.5 pl-4 text-[14px] leading-snug text-muted transition-colors hover:border-lav-600 hover:text-ink"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <nav aria-label="Other legal documents" className="mt-10 hidden lg:block">
              <p className="label-caps">Other policies</p>
              <ul className="mt-4 space-y-2">
                {legalDocs
                  .filter((d) => d.slug !== doc.slug)
                  .map((d) => (
                    <li key={d.slug}>
                      <Link href={`/legal/${d.slug}`} className="text-link text-[14px]">
                        {d.title}
                      </Link>
                    </li>
                  ))}
              </ul>
            </nav>
          </aside>

          <article className="max-w-[68ch]">
            {doc.sections.map((s) => (
              <section key={s.id} id={s.id} className="border-b border-line py-9 first:pt-0 last:border-b-0">
                <h2 className="text-[22px] font-semibold tracking-[-0.016em] text-ink">{s.title}</h2>
                <div className="mt-4 space-y-4 text-[16px] leading-[1.75] text-ink-2">
                  {s.body.map((block, i) =>
                    typeof block === "string" ? (
                      <p key={i}>{block}</p>
                    ) : (
                      <ul key={i} className="list-disc space-y-2 pl-5 marker:text-lav-500">
                        {block.list.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ),
                  )}
                </div>
              </section>
            ))}
          </article>
        </div>
      </div>
    </>
  );
}
