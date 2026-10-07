import type { Metadata } from "next";
import { AnnouncementForm } from "@/components/admin/content-forms";
import { AdminHeader } from "@/components/admin/parts";
import { requireAdminConsole } from "@/lib/admin/guard";
import { getSettingsMap, parseAnnouncement } from "@/lib/admin/queries-system";

export const metadata: Metadata = { title: "Announcement" };

export default async function AnnouncementPage() {
  await requireAdminConsole();
  const settings = await getSettingsMap();
  return (
    <>
      <AdminHeader title="Announcement" description="A single line above the public site's header — for offers, planned maintenance or news. It shows only between its start and end times." />
      <AnnouncementForm initial={parseAnnouncement(settings.announcement)} />
    </>
  );
}
