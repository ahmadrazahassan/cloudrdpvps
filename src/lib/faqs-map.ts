import type { Faq } from "@/content/faqs";

export interface FaqRow {
  slug: string;
  category: string;
  question: string;
  answer_md: string;
  sort_order: number;
}

export interface FaqCategoryInfo {
  id: string;
  label: string;
  blurb: string;
}

export interface FaqContent {
  faqs: Faq[];
  categories: FaqCategoryInfo[];
  /** The few shown on the homepage. */
  home: Faq[];
}

const titleCase = (s: string) => s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Turn the published rows of the `faqs` table into what the public pages render. Categories the site
 * already has keep their order, label and blurb; any other category an admin creates is added after
 * them. An empty table means "use the built-in content" (the caller passes that as `base`).
 */
export function mapFaqRows(rows: FaqRow[], base: FaqContent, homeIds: ReadonlySet<string>): FaqContent {
  if (rows.length === 0) return base;

  const faqs: Faq[] = rows.map((r) => ({ id: r.slug, category: r.category, question: r.question, answer: r.answer_md, home: homeIds.has(r.slug) || undefined }));
  const present = new Set(faqs.map((f) => f.category));
  const known = base.categories.filter((c) => present.has(c.id));
  const knownIds = new Set(known.map((c) => c.id));
  const extra = [...present]
    .filter((c) => !knownIds.has(c))
    .sort()
    .map((c) => ({ id: c, label: titleCase(c), blurb: "" }));

  const flagged = faqs.filter((f) => f.home);
  return { faqs, categories: [...known, ...extra], home: flagged.length > 0 ? flagged : faqs.slice(0, 4) };
}

/** Markdown answer → plain text for search-engine structured data. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}
