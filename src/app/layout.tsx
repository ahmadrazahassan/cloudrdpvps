import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { site } from "@/content/site";
import { getCatalog, placesPhrase } from "@/lib/catalog";
import "./globals.css";

/**
 * The site's entire typography: two families, both variable (every weight from one file each),
 * self-hosted by next/font at build time (no request to Google from the visitor's browser).
 *  - Inter Tight  — display, headings, prices (--font-inter-tight)
 *  - Inter        — body, UI, labels, data              (--font-inter)
 * `adjustFontFallback` (default) sizes the system fallback to match, so swapping causes no layout shift.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  // Where we sell is whatever the owner has switched on; a catalog hiccup must never take the whole site down.
  let where = "countries around the world";
  try {
    where = placesPhrase((await getCatalog()).locations);
  } catch {
    /* generic wording */
  }
  return {
    metadataBase: new URL(site.url),
    title: {
      default: `${site.name} — Windows RDP & VPS in ${where}`,
      template: `%s · ${site.name}`,
    },
    description: site.description,
    applicationName: site.name,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: site.name,
      title: `${site.name} — Windows RDP & VPS`,
      description: site.description,
      url: "/",
    },
    twitter: {
      card: "summary_large_image",
      title: `${site.name} — Windows RDP & VPS`,
      description: site.description,
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: "#F1F1F1",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${interTight.variable}`}
    >
      <body>
        <noscript>
          <style>{`.reveal{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
