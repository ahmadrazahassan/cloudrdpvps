// The floating WhatsApp chat as the site mounts it: the admin setting goes in, a widget (or nothing) comes out.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const settings = vi.hoisted(() => ({ whatsapp: null as string | null }));

vi.mock("next/navigation", () => ({ usePathname: () => "/pricing" }));
vi.mock("@/lib/site-settings", () => ({
  getSiteSettings: async () => ({ name: "Cloud RDP VPS", whatsapp: settings.whatsapp }),
}));

import { WhatsAppChat } from "./whatsapp-chat";

const render = async () => renderToStaticMarkup(await WhatsAppChat());

describe("<WhatsAppChat />", () => {
  beforeEach(() => {
    settings.whatsapp = null;
  });

  it("renders nothing until the owner sets a WhatsApp number", async () => {
    expect(await render()).toBe("");
  });

  it("shows the launcher, closed and labelled, once a number is set", async () => {
    settings.whatsapp = "https://wa.me/923001234567";
    const html = await render();
    expect(html).toContain('aria-label="Chat with us on WhatsApp"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain("background-color:#25D366"); // the official WhatsApp green
    // the panel is not in the page until it is opened
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("Start chat on WhatsApp");
  });

  it("accepts a business short link and a group-style link the same way", async () => {
    settings.whatsapp = "https://wa.me/message/ABC123xyz";
    expect(await render()).toContain("Chat with us on WhatsApp");
  });

  it("refuses to render for a link that isn't WhatsApp's, whatever is stored", async () => {
    for (const bad of ["https://evil.example/923001234567", "http://wa.me/923001234567", "javascript:alert(1)", "not a link", ""]) {
      settings.whatsapp = bad;
      expect(await render(), bad).toBe("");
    }
  });
});
