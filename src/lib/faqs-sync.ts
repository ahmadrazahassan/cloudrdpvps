import type { SupabaseClient } from "@supabase/supabase-js";
import { faqs } from "@/content/faqs";
import type { Database } from "@/types/database";

/**
 * Load the site's built-in FAQ answers into the `faqs` table so they can be edited in Admin → Content.
 *
 *  - Questions the table doesn't have yet are added.
 *  - Rows still in the original seeded placeholder state (category "general") are replaced with the
 *    built-in answer of the same address — those were stand-ins for exactly this content.
 *  - Anything an admin has since edited or recategorised is never touched.
 * Safe to run more than once.
 */
export async function syncBuiltinFaqs(client: SupabaseClient<Database>): Promise<{ added: number; updated: number }> {
  const existing = await client.from("faqs").select("slug, category");
  if (existing.error) throw existing.error;
  const bySlug = new Map((existing.data ?? []).map((r) => [r.slug, r.category]));

  const rows = faqs.map((f, i) => ({ slug: f.id, category: f.category, question: f.question, answer_md: f.answer, sort_order: (i + 1) * 10, is_published: true }));
  const toAdd = rows.filter((r) => !bySlug.has(r.slug));
  const toReplace = rows.filter((r) => bySlug.get(r.slug) === "general");

  if (toAdd.length > 0) {
    const { error } = await client.from("faqs").insert(toAdd);
    if (error) throw error;
  }
  for (const r of toReplace) {
    const { error } = await client.from("faqs").update({ ...r, updated_at: new Date().toISOString() }).eq("slug", r.slug);
    if (error) throw error;
  }
  return { added: toAdd.length, updated: toReplace.length };
}
