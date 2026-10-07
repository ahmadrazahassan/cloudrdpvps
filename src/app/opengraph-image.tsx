import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { site } from "@/content/site";
import { LogoArtwork } from "@/components/brand/brand-mark";
import brand from "@/content/brand.json";

export const alt = `${site.name} — Windows RDP & VPS`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Social share image, drawn in code: the page colour, the complete vector logo, one line of
 * headline in Inter Tight and a lavender label in Inter — flat, no gradients.
 * ImageResponse can't read next/font, so it loads the same two families from
 * their @fontsource packages (read once at module scope; woff is supported).
 */
const fontFile = (pkg: string, file: string) =>
  readFile(path.join(process.cwd(), "node_modules", "@fontsource", pkg, "files", file));

const fonts = Promise.all([
  fontFile("inter-tight", "inter-tight-latin-500-normal.woff"),
  fontFile("inter", "inter-latin-500-normal.woff"),
]);

export default async function OpengraphImage() {
  const [tight500, inter500] = await fonts;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#F1F1F1",
          padding: 72,
          color: "#121214",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <LogoArtwork width={400} height={400 * brand.lockupHeight / brand.lockupWidth} />
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontFamily: "Inter",
              fontWeight: 500,
              fontSize: 24,
              letterSpacing: 1.6,
              color: "#7C4FCF",
              textTransform: "uppercase",
              marginBottom: 28,
            }}
          >
            Windows RDP & VPS · 30-day plans · USD
          </div>
          <div
            style={{
              fontFamily: "Inter Tight",
              fontWeight: 500,
              fontSize: 96,
              lineHeight: 1.02,
              letterSpacing: -3,
              maxWidth: 980,
            }}
          >
            Windows RDP and VPS, ready when you are.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 36,
            borderTop: "2px solid #D2D2D8",
            paddingTop: 28,
            fontFamily: "Inter",
            fontWeight: 500,
            fontSize: 24,
            color: "#3F3F46",
          }}
        >
          <span>United States</span>
          <span>United Kingdom</span>
          <span>Germany</span>
          <span>Singapore</span>
          <span>+ 70 more</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter Tight", data: tight500, weight: 500, style: "normal" },
        { name: "Inter", data: inter500, weight: 500, style: "normal" },
      ],
    },
  );
}
