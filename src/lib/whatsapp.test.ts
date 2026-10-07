import { describe, expect, it } from "vitest";
import { MESSAGE_MAX, normalizeWhatsAppInput, parseWhatsAppTarget, whatsAppChatUrl, whatsAppMessage } from "./whatsapp";

describe("parseWhatsAppTarget", () => {
  it("reads the common number links", () => {
    expect(parseWhatsAppTarget("https://wa.me/923001234567")).toEqual({ url: "https://wa.me/923001234567", phone: "923001234567" });
    expect(parseWhatsAppTarget("https://wa.me/+923001234567/")).toEqual({ url: "https://wa.me/923001234567", phone: "923001234567" });
    expect(parseWhatsAppTarget("https://api.whatsapp.com/send?phone=923001234567&text=old")).toEqual({ url: "https://wa.me/923001234567", phone: "923001234567" });
    expect(parseWhatsAppTarget("https://wa.me/923001234567?text=hello")?.url).toBe("https://wa.me/923001234567");
  });

  it("keeps business and group links as they are, with no number to fill a message into", () => {
    expect(parseWhatsAppTarget("https://wa.me/message/ABC123xyz")).toEqual({ url: "https://wa.me/message/ABC123xyz", phone: null });
    expect(parseWhatsAppTarget("https://chat.whatsapp.com/Kx92abCD")).toEqual({ url: "https://chat.whatsapp.com/Kx92abCD", phone: null });
  });

  it("refuses anything that is not a WhatsApp chat link", () => {
    for (const bad of [
      null,
      undefined,
      "",
      "   ",
      "not a url",
      "http://wa.me/923001234567",
      "https://evil.example/923001234567",
      "https://wa.me.evil.example/923001234567",
      "https://evil.example/wa.me/923001234567",
      "https://user:pass@wa.me/923001234567",
      "https://wa.me:8443/923001234567",
      "javascript:alert(1)",
      "https://wa.me/0300123456",
      "https://wa.me/12345",
      "https://wa.me/",
      "https://wa.me/message/",
      "https://api.whatsapp.com/send?phone=abc",
      "https://whatsapp.com/channel/0029Va",
    ]) {
      expect(parseWhatsAppTarget(bad), String(bad)).toBeNull();
    }
  });
});

describe("normalizeWhatsAppInput", () => {
  it("turns a typed number into the canonical link", () => {
    for (const typed of ["+92 300 1234567", "92-300-1234567", "(92) 300 123 4567", "0092 300 1234567", "+923001234567"]) {
      expect(normalizeWhatsAppInput(typed), typed).toEqual({ ok: true, value: "https://wa.me/923001234567" });
    }
  });

  it("rejects a local number without a country code, and numbers that are too short or too long", () => {
    for (const typed of ["03001234567", "300123", "+1234567890123456", "+92 3x0 1234567"]) {
      expect(normalizeWhatsAppInput(typed).ok, typed).toBe(false);
    }
  });

  it("cleans a pasted link and rejects other sites", () => {
    expect(normalizeWhatsAppInput(" https://api.whatsapp.com/send?phone=923001234567&text=hi ")).toEqual({ ok: true, value: "https://wa.me/923001234567" });
    expect(normalizeWhatsAppInput("https://wa.me/message/ABC123")).toEqual({ ok: true, value: "https://wa.me/message/ABC123" });
    expect(normalizeWhatsAppInput("https://t.me/yourname").ok).toBe(false);
    expect(normalizeWhatsAppInput("https://evil.example/923001234567").ok).toBe(false);
    expect(normalizeWhatsAppInput("https://wa.me.evil.example/923001234567").ok).toBe(false);
    expect(normalizeWhatsAppInput("http://evil.example/wa.me/923001234567").ok).toBe(false);
  });

  it("is forgiving about how a number or link was typed", () => {
    for (const typed of ["* 92 309 3871661", "＋92 309 3871661", "+92 309 3871661", "92 309 3871661", "+92-309-3871661", "wa.me/923093871661", "http://wa.me/923093871661", "www.whatsapp.com/send?phone=923093871661", "https://wa.me/923093871661"]) {
      expect(normalizeWhatsAppInput(typed), typed).toEqual({ ok: true, value: "https://wa.me/923093871661" });
    }
    expect(normalizeWhatsAppInput("wa.me/message/ABC123")).toEqual({ ok: true, value: "https://wa.me/message/ABC123" });
  });
});

describe("whatsAppMessage + whatsAppChatUrl", () => {
  const target = parseWhatsAppTarget("https://wa.me/923001234567")!;

  it("falls back to a greeting and always says which page the visitor is on", () => {
    expect(whatsAppMessage({ siteName: "Cloud RDP VPS", pageUrl: "https://cloudrdpvps.com/pricing" })).toBe(
      "Hi Cloud RDP VPS! I have a question.\n\nSent from https://cloudrdpvps.com/pricing",
    );
    expect(whatsAppMessage({ siteName: "X", text: "  Do you have a Windows VPS in India?  ", pageUrl: "https://x.test/vps" })).toBe(
      "Do you have a Windows VPS in India?\n\nSent from https://x.test/vps",
    );
    expect(whatsAppMessage({ siteName: "X", text: "hello" })).toBe("hello");
  });

  it("caps what is put in the link", () => {
    const long = whatsAppMessage({ siteName: "X", text: "a".repeat(MESSAGE_MAX * 3) });
    expect(long.length).toBe(MESSAGE_MAX);
  });

  it("encodes every character so the message arrives exactly as typed", () => {
    const message = "Price for 2 & 3 servers? 100% sure — ½ price: ok\nnext line #1 ✅";
    const url = new URL(whatsAppChatUrl(target, message));
    expect(url.origin + url.pathname).toBe("https://wa.me/923001234567");
    expect(url.searchParams.get("text")).toBe(message);
    expect(url.search.startsWith("?text=")).toBe(true);
  });

  it("opens links that can't carry a message as they are", () => {
    const business = parseWhatsAppTarget("https://wa.me/message/ABC123")!;
    expect(whatsAppChatUrl(business, "hello")).toBe("https://wa.me/message/ABC123");
  });
});
