"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { action } from "@/lib/action";
import { AppError, fromDbError } from "@/lib/errors";
import { CATALOG_TAG } from "@/lib/supabase/public";
import { optionalText, uuid } from "@/lib/validation";
import { syncBuiltinFaqs } from "@/lib/faqs-sync";
import { throwSaveError } from "../save-error";

const bust = () => {
  updateTag(CATALOG_TAG); // FAQs and settings are read through the same tagged public client
  revalidatePath("/", "layout");
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

// ---------------------------------------------------------------------------
// FAQs
// ---------------------------------------------------------------------------
export const saveFaq = action({
  name: "admin-save-faq",
  auth: "admin",
  rateLimit: { limit: 200, window: "1 h" },
  schema: z.object({
    id: z.union([z.literal(""), uuid]).optional(),
    category: z.string().trim().min(2, "Enter a category.").max(40),
    question: z.string().trim().min(5, "Write the question.").max(200),
    answer_md: z.string().trim().min(5, "Write the answer.").max(6000),
    slug: z.string().trim().max(60).default(""),
    sort_order: z.coerce.number().int().min(0).max(10000).default(0),
    is_published: z.boolean(),
  }),
  async handler({ id, slug, ...v }, { supabase }) {
    const row = { ...v, category: v.category.toLowerCase(), slug: slugify(slug || v.question) };
    if (!row.slug) throw new AppError("VALIDATION", undefined, { fieldErrors: { question: ["Use some letters or numbers in the question."] } });
    const { error } = id ? await supabase.from("faqs").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id) : await supabase.from("faqs").insert(row);
    if (error) throwSaveError(error, "slug", "Another FAQ already uses that address.");
    bust();
    return { saved: true as const };
  },
});

export const deleteFaq = action({
  name: "admin-delete-faq",
  auth: "admin",
  rateLimit: { limit: 100, window: "1 h" },
  schema: z.object({ id: uuid }),
  async handler({ id }, { supabase }) {
    const { error } = await supabase.from("faqs").delete().eq("id", id);
    if (error) throw fromDbError(error);
    bust();
    return { deleted: true as const };
  },
});

/** Load the site's built-in FAQ answers into the table so they can be edited here. Adds what is missing; never overwrites an admin's edits. */
export const importBuiltinFaqs = action({
  name: "admin-import-faqs",
  auth: "admin",
  rateLimit: { limit: 10, window: "1 h" },
  schema: z.object({}),
  async handler(_input, { supabase }) {
    try {
      const result = await syncBuiltinFaqs(supabase);
      bust();
      return result;
    } catch (error) {
      throw fromDbError(error as { code?: string; message?: string });
    }
  },
});

// ---------------------------------------------------------------------------
// Announcement banner (site_settings.announcement, public)
// ---------------------------------------------------------------------------
export const saveAnnouncement = action({
  name: "admin-save-announcement",
  auth: "admin",
  rateLimit: { limit: 60, window: "1 h" },
  schema: z.object({
    enabled: z.boolean(),
    text: z.string().trim().max(200, "Keep it under 200 characters."),
    link: z
      .string()
      .trim()
      .max(300)
      .refine((v) => v === "" || v.startsWith("/") || /^https:\/\//i.test(v), "Use a page on this site (/pricing) or a full https:// link."),
    tone: z.enum(["info", "warn"]),
    starts_at: z.union([z.literal(""), z.iso.datetime({ offset: true })]),
    ends_at: z.union([z.literal(""), z.iso.datetime({ offset: true })]),
  }),
  async handler(v, { supabase, user }) {
    if (v.enabled && !v.text) throw new AppError("VALIDATION", undefined, { fieldErrors: { text: ["Write the announcement text."] } });
    if (v.starts_at && v.ends_at && Date.parse(v.ends_at) <= Date.parse(v.starts_at)) {
      throw new AppError("VALIDATION", undefined, { fieldErrors: { ends_at: ["The end must be after the start."] } });
    }
    const value = { enabled: v.enabled, text: v.text, link: v.link, tone: v.tone, starts_at: v.starts_at || null, ends_at: v.ends_at || null };
    const { error } = await supabase.from("site_settings").upsert({ key: "announcement", value, is_public: true, updated_by: user!.id, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw fromDbError(error);
    bust();
    return { saved: true as const };
  },
});

// ---------------------------------------------------------------------------
// Canned (saved) replies
// ---------------------------------------------------------------------------
export const saveCannedResponse = action({
  name: "admin-save-canned",
  auth: "staff",
  rateLimit: { limit: 100, window: "1 h" },
  schema: z.object({
    id: z.union([z.literal(""), uuid]).optional(),
    title: z.string().trim().min(2, "Give it a short title.").max(80),
    body_md: z.string().trim().min(2, "Write the reply.").max(4000),
  }),
  async handler({ id, title, body_md }, { supabase, user }) {
    const { error } = id ? await supabase.from("canned_responses").update({ title, body_md }).eq("id", id) : await supabase.from("canned_responses").insert({ title, body_md, created_by: user!.id });
    if (error) throw fromDbError(error);
    revalidatePath("/admin", "layout");
    return { saved: true as const };
  },
});

export const deleteCannedResponse = action({
  name: "admin-delete-canned",
  auth: "staff",
  rateLimit: { limit: 100, window: "1 h" },
  schema: z.object({ id: uuid }),
  async handler({ id }, { supabase }) {
    const { error } = await supabase.from("canned_responses").delete().eq("id", id);
    if (error) throw fromDbError(error);
    revalidatePath("/admin", "layout");
    return { deleted: true as const };
  },
});

// keep optionalText referenced for future fields
void optionalText;
