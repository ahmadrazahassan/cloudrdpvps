import type { Metadata } from "next";
import { FilterLinks, param } from "@/components/portal/list-controls";
import { PageHeader, Section } from "@/components/portal/page-header";
import {
  DeletionForm,
  EmailForm,
  PasswordForm,
  PreferencesForm,
  ProfileForm,
  SignOutEverywhere,
} from "@/components/portal/settings-forms";
import { TwoStep } from "@/components/portal/two-step";
import { countryOptions } from "@/content/countries";
import { getCustomerMfa } from "@/lib/auth/mfa";
import { isStaff, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const TABS = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "preferences", label: "Preferences" },
  { id: "account", label: "Account" },
] as const;

export default async function SettingsPage({ searchParams }: Props) {
  const user = await requireUser("/dashboard/settings");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === param(sp.tab))?.id ?? "profile";
  const p = user.profile;
  const prefs = (p.notification_prefs ?? {}) as Record<string, unknown>;

  const mfa = tab === "security" ? await getCustomerMfa() : { enabled: false };

  let hasActiveServers = false;
  if (tab === "account") {
    const supabase = await createClient();
    const { count } = await supabase.from("services").select("id", { count: "exact", head: true }).in("status", ["active", "suspended"]);
    hasActiveServers = (count ?? 0) > 0;
  }

  return (
    <>
      <PageHeader title="Settings" description="Your details, security and notification choices." />
      <FilterLinks
        label="Settings sections"
        items={TABS.map((t) => ({ id: t.id, label: t.label }))}
        current={tab}
        hrefFor={(id) => (id === "profile" ? "/dashboard/settings" : `/dashboard/settings?tab=${id}`)}
      />

      <div className="pt-10">
        {tab === "profile" && (
          <ProfileForm
            countries={countryOptions()}
            values={{
              fullName: p.full_name,
              phone: p.phone ?? "",
              billingCountry: p.billing_country?.trim() ?? "",
              company: p.company ?? "",
              telegram: p.telegram ?? "",
              whatsapp: p.whatsapp ?? "",
            }}
          />
        )}

        {tab === "security" && (
          <div>
            <Section title="Password" description="Changing it signs your other devices out.">
              <PasswordForm />
            </Section>
            <Section title="Two-step verification" description="Protect your account with a code from an authenticator app.">
              <TwoStep enabled={mfa.enabled} canDisable={!isStaff(user)} />
            </Section>
            <Section title="Email address" description="We'll send a confirmation link to the new address.">
              <EmailForm current={user.email} />
            </Section>
            <Section title="Sessions" description="If you've used a shared computer, or think someone else has access.">
              <SignOutEverywhere />
            </Section>
          </div>
        )}

        {tab === "preferences" && (
          <PreferencesForm ticketReplies={prefs.ticket_replies !== false} marketing={prefs.marketing === true} />
        )}

        {tab === "account" && (
          <Section title="Delete my account" description="This can't be undone once it's done, so a person checks first.">
            <DeletionForm blocked={hasActiveServers} />
          </Section>
        )}
      </div>
    </>
  );
}
