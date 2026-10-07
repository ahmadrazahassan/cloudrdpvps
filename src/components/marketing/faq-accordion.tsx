import { Plus } from "lucide-react";
import { SafeMarkdown } from "@/components/shared/safe-markdown";
import type { Faq } from "@/content/faqs";

/**
 * Native <details> accordion: zero JavaScript, works without JS, keyboard and
 * screen-reader accessible out of the box. The shared `name` makes it
 * exclusive (opening one closes the others) in modern browsers.
 */
export function FaqAccordion({ items }: { items: Faq[] }) {
  return (
    <div className="border-t border-line">
      {items.map((f) => (
        <details key={f.id} name="faq" className="group border-b border-line">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-[17px] font-medium text-ink transition-colors hover:text-lav-700 [&::-webkit-details-marker]:hidden">
            {f.question}
            <Plus
              aria-hidden
              size={20}
              strokeWidth={1.5}
              className="shrink-0 text-muted transition-transform duration-200 group-open:rotate-45"
            />
          </summary>
          <SafeMarkdown source={f.answer} className="max-w-[62ch] pb-6 pr-10" />
        </details>
      ))}
    </div>
  );
}
