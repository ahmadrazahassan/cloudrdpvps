import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { NotFoundContent } from "@/components/marketing/not-found-content";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

/** Any URL that matches no route at all (the (marketing) group has its own for notFound() calls). */
export default function RootNotFound() {
  return (
    <MarketingShell>
      <NotFoundContent />
    </MarketingShell>
  );
}
