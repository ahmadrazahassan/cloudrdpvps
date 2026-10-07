import type { ReactNode } from "react";
import { parseMarkdown, type Inline } from "@/lib/markdown";
import { cn } from "@/lib/utils";

function renderInline(parts: Inline[]): ReactNode {
  return parts.map((p, i) => {
    if (p.type === "bold") return <strong key={i}>{p.text}</strong>;
    if (p.type === "link") {
      return (
        <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className="text-link">
          {p.text}
        </a>
      );
    }
    return <span key={i}>{p.text}</span>;
  });
}

/** Renders the safe markdown subset from lib/markdown.ts as React elements. */
export function SafeMarkdown({ source, className }: { source: string; className?: string }) {
  const blocks = parseMarkdown(source);
  return (
    <div className={cn("space-y-3 text-[15px] leading-[1.7] text-ink-2", className)}>
      {blocks.map((b, i) => {
        if (b.type === "ul") {
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-lav-500">
              {b.items.map((it, j) => (
                <li key={j}>{renderInline(it)}</li>
              ))}
            </ul>
          );
        }
        if (b.type === "ol") {
          return (
            <ol key={i} className="list-decimal space-y-1.5 pl-5 marker:text-muted">
              {b.items.map((it, j) => (
                <li key={j}>{renderInline(it)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i}>
            {b.lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {renderInline(line)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
