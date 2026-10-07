"use client";

import { debounce, parseAsString, useQueryState } from "nuqs";
import type { ReactNode } from "react";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { Faq, FaqCategory } from "@/content/faqs";
// (FaqCategory is an open string: admins can add their own categories.)
import { FaqAccordion } from "./faq-accordion";

/**
 * Full FAQ with a live filter. The search lives in the URL (?q=) so a filtered
 * view can be shared, and every question stays in the server-rendered HTML for
 * search engines. Matching is "every word appears in the question or answer".
 */
export function FaqBrowser({
  items,
  categories,
  emptyArt,
}: {
  items: Faq[];
  categories: { id: FaqCategory; label: string; blurb: string }[];
  emptyArt: ReactNode;
}) {
  const [q, setQ] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({
      history: "replace",
      shallow: true,
      scroll: false,
      clearOnDefault: true,
      limitUrlUpdates: debounce(250),
    }),
  );

  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (f: Faq) => {
    const hay = `${f.question} ${f.answer}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  };
  const filtered = items.filter(matches);
  const groups = categories
    .map((c) => ({ ...c, items: filtered.filter((f) => f.category === c.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <div>
      <div className="max-w-[520px]">
        <Field
          label="Search the FAQ"
          name="q"
          type="search"
          value={q}
          onChange={(e) => void setQ(e.target.value)}
          placeholder="For example: refund, renew, connect"
          autoComplete="off"
          enterKeyHint="search"
        />
      </div>
      <p role="status" aria-live="polite" className="mt-3 text-[13px] text-muted">
        {terms.length === 0
          ? `${items.length} questions`
          : filtered.length === 0
            ? "No questions match your search."
            : `${filtered.length} ${filtered.length === 1 ? "question matches" : "questions match"} your search.`}
      </p>

      {groups.length === 0 ? (
        <div className="mx-auto mt-14 max-w-[420px] text-center">
          <div className="mx-auto h-[180px] w-[180px]">{emptyArt}</div>
          <h2 className="mt-6 text-[22px] font-semibold tracking-[-0.015em] text-ink">Nothing found.</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Try a different word, or clear the search to see every question.
          </p>
          <Button variant="secondary" className="mt-6" onClick={() => void setQ("")}>
            Clear search
          </Button>
        </div>
      ) : (
        <div className="mt-12 space-y-16">
          {groups.map((g) => (
            <section key={g.id} aria-labelledby={`faq-${g.id}`} className="grid gap-6 lg:grid-cols-[1fr_2fr] lg:gap-16">
              <div>
                <h2 id={`faq-${g.id}`} className="text-[22px] font-semibold tracking-[-0.015em] text-ink">
                  {g.label}
                </h2>
                <p className="mt-2 max-w-[28ch] text-[15px] leading-relaxed text-muted">{g.blurb}</p>
              </div>
              <FaqAccordion items={g.items} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
