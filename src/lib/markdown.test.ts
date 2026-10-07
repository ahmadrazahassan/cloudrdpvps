import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown } from "./markdown";

describe("parseInline", () => {
  it("splits bold and links out of plain text", () => {
    expect(parseInline("Send **USD 12** to [our page](https://example.com/pay) now")).toEqual([
      { type: "text", text: "Send " },
      { type: "bold", text: "USD 12" },
      { type: "text", text: " to " },
      { type: "link", text: "our page", href: "https://example.com/pay" },
      { type: "text", text: " now" },
    ]);
  });

  it("only turns http(s) and mailto into links — javascript: stays plain text", () => {
    const out = parseInline("[click](javascript:alert(1)) or [mail](mailto:a@b.co)");
    expect(out.filter((p) => p.type === "link")).toEqual([{ type: "link", text: "mail", href: "mailto:a@b.co" }]);
    expect(out.map((p) => p.type)).not.toContain("html");
  });

  it("never interprets markup characters as HTML", () => {
    expect(parseInline("<script>alert(1)</script>")).toEqual([{ type: "text", text: "<script>alert(1)</script>" }]);
  });
});

describe("parseMarkdown", () => {
  it("groups paragraphs, bullets and numbered steps", () => {
    const md = "First paragraph\nsecond line\n\n- one\n- two\n\n1. open\n2) send";
    const blocks = parseMarkdown(md);
    expect(blocks.map((b) => b.type)).toEqual(["p", "ul", "ol"]);
    expect(blocks[0]).toMatchObject({ type: "p" });
    expect((blocks[0] as { lines: unknown[] }).lines).toHaveLength(2);
    expect((blocks[1] as { items: unknown[] }).items).toHaveLength(2);
    expect((blocks[2] as { items: unknown[] }).items).toHaveLength(2);
  });

  it("handles empty input and Windows line endings", () => {
    expect(parseMarkdown("")).toEqual([]);
    expect(parseMarkdown("a\r\n\r\nb").map((b) => b.type)).toEqual(["p", "p"]);
  });
});
