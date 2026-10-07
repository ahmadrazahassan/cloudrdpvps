/**
 * A deliberately tiny, safe markdown subset for admin-written text (payment
 * instructions, FAQ answers): paragraphs, bullet/numbered lists, **bold**, and
 * http(s)/mailto links. It returns a plain data structure; the component turns that
 * into React elements, so no HTML string is ever built or injected.
 */
export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "link"; text: string; href: string };

export type Block =
  | { type: "p"; lines: Inline[][] }
  | { type: "ul"; items: Inline[][] }
  | { type: "ol"; items: Inline[][] };

const TOKEN = /(\*\*[^*\n]+\*\*|\[[^\]\n]+\]\((?:https?:\/\/|mailto:)[^)\s]+\))/g;

export function parseInline(input: string): Inline[] {
  return input
    .split(TOKEN)
    .filter((part) => part !== "")
    .map((part): Inline => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return { type: "bold", text: part.slice(2, -2) };
      }
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
      if (link) return { type: "link", text: link[1]!, href: link[2]! };
      return { type: "text", text: part };
    });
}

const BULLET = /^\s*[-*]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;

export function parseMarkdown(source: string): Block[] {
  return source
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk): Block => {
      const lines = chunk.split("\n");
      if (lines.every((l) => BULLET.test(l))) {
        return { type: "ul", items: lines.map((l) => parseInline(l.replace(BULLET, ""))) };
      }
      if (lines.every((l) => NUMBERED.test(l))) {
        return { type: "ol", items: lines.map((l) => parseInline(l.replace(NUMBERED, ""))) };
      }
      return { type: "p", lines: lines.map((l) => parseInline(l.trim())) };
    });
}
