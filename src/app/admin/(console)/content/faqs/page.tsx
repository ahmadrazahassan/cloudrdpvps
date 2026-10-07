import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/parts";
import { ImportFaqs } from "@/components/admin/content-forms";
import { DeleteFaq, FaqEditor } from "@/components/admin/editors";
import { AdminBadge } from "@/components/admin/status";
import { LedgerSection } from "@/components/ledger/primitives";
import { Card, Row, RowList } from "@/components/portal/cards";
import { requireAdminConsole } from "@/lib/admin/guard";
import { getFaqsAdmin } from "@/lib/admin/queries-system";
import { plainText } from "@/lib/faqs-map";

export const metadata: Metadata = { title: "FAQs" };

export default async function FaqsPage() {
  await requireAdminConsole();
  const faqs = await getFaqsAdmin();
  const categories = [...new Set(faqs.map((f) => f.category))];

  return (
    <>
      <AdminHeader
        title="FAQs"
        description="The questions on the public FAQ page, the homepage and the product and location pages. Once there is at least one published FAQ here, the site shows these instead of its built-in answers."
        actions={<FaqEditor categories={categories} />}
      />
      {faqs.length === 0 && (
        <Card padded>
          <p className="mb-4 text-[15px] text-ink">The public site is showing its built-in answers. Import them to edit them here.</p>
          <ImportFaqs />
        </Card>
      )}
      {categories.map((cat) => (
        <LedgerSection flush key={cat} title={cat} aside={`${faqs.filter((f) => f.category === cat).length} questions`}>
          <RowList>
            {faqs
              .filter((f) => f.category === cat)
              .map((f) => (
                <Row key={f.id} className="flex flex-wrap items-start gap-x-5 gap-y-2">
                  <div className="min-w-[240px] flex-1">
                    <p className="text-[15px] font-semibold text-ink">{f.question}</p>
                    <p className="mt-1 line-clamp-2 max-w-[80ch] text-[13.5px] text-muted">{plainText(f.answer_md)}</p>
                  </div>
                  <span className="num-tabular text-[12px] text-muted">#{f.sort_order}</span>
                  <AdminBadge kind="account" status={f.is_published ? "active" : "suspended"} />
                  <FaqEditor faq={f} categories={categories} />
                  <DeleteFaq id={f.id} question={f.question} />
                </Row>
              ))}
          </RowList>
        </LedgerSection>
      ))}
      {faqs.length > 0 && (
        <Card padded>
          <p className="mb-3 text-[13px] text-muted">Missing some of the built-in answers? This adds only what isn&apos;t here yet and never overwrites your edits.</p>
          <ImportFaqs />
        </Card>
      )}
    </>
  );
}
