import "server-only";
import { cache } from "react";
import { faqCategories, faqs as builtIn, homeFaqs } from "@/content/faqs";
import { isSupabaseConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";
import { mapFaqRows, type FaqContent } from "./faqs-map";

const builtInContent = (): FaqContent => ({ faqs: builtIn, categories: faqCategories, home: homeFaqs });

/**
 * The FAQ the public site shows: the published rows an admin manages in Admin → Content → FAQs, or the
 * built-in answers while that table is empty (or the database can't be reached — a settings hiccup must
 * never take the FAQ page down). Read through the tagged public client, so an admin's save shows up at once.
 */
export const getFaqContent = cache(async (): Promise<FaqContent> => {
  if (!isSupabaseConfigured) return builtInContent();
  try {
    const { data, error } = await createPublicClient()
      .from("faqs")
      .select("slug, category, question, answer_md, sort_order")
      .eq("is_published", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return mapFaqRows(data ?? [], builtInContent(), new Set(homeFaqs.map((f) => f.id)));
  } catch (error) {
    console.error("[faqs] falling back to built-in content:", error instanceof Error ? error.message : error);
    return builtInContent();
  }
});

/** A handful of questions by id (product, pricing and location pages each pick their own). */
export async function getFaqsById(ids: string[]) {
  const { faqs } = await getFaqContent();
  return ids.flatMap((id) => faqs.filter((f) => f.id === id));
}
