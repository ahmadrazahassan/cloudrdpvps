import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MfaPanel } from "@/components/auth/mfa-panel";
import { AdminTag } from "@/components/admin/shell/admin-sidebar";
import { Logo } from "@/components/brand/logo";
import { Card } from "@/components/portal/cards";
import { getStaffAal } from "@/lib/auth/mfa";
import { requireStaff } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Two-step verification", robots: { index: false, follow: false } };

/** Outside the console layout on purpose: it must be reachable before the second factor has been passed. */
export default async function MfaPage() {
  await requireStaff();
  const aal = await getStaffAal();
  if (aal.satisfied) redirect("/admin");

  return (
    <div className="flex min-h-dvh flex-col">
      <header>
        <div className="container-site flex h-16 items-center justify-between">
          <span className="inline-flex items-center gap-3">
            <Logo href={null} />
            <AdminTag />
          </span>
          <Link href="/dashboard" className="text-sm text-ink-2 hover:text-ink">
            ← Customer dashboard
          </Link>
        </div>
      </header>
      <main id="main" className="flex-1">
        <Card padded className="mx-auto my-10 w-[calc(100%-32px)] max-w-[480px] sm:my-20 sm:p-10">
          <p className="label-caps">Staff sign-in</p>
          <h1 className="mt-4 font-display text-[30px] font-semibold leading-[1.12] tracking-[-0.026em]">
            {aal.enrolled ? "Enter your code" : "Set up two-step verification"}
          </h1>
          <p className="mt-3 text-[15.5px] leading-[1.6] text-ink-2">
            {aal.enrolled
              ? "Open your authenticator app and enter the 6-digit code to continue to the console."
              : "The console can approve payments and see login details, so staff accounts need a second step. It takes a minute."}
          </p>
          <div className="mt-8">
            <MfaPanel enrolled={aal.enrolled} next="/admin" />
          </div>
        </Card>
      </main>
    </div>
  );
}
