import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { AdminSkeleton, PageTitle } from "@/components/admin/bits";
import { SettingsForm } from "@/components/admin/settings-form";
import { requireAdmin } from "@/lib/admin/auth";
import { readSettings, SETTING_GROUPS, SETTINGS } from "@/lib/admin/settings";
import { db } from "@/lib/db/client";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Configurações" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <SettingsView />
    </Suspense>
  );
}

async function SettingsView() {
  await connection();
  await requireAdmin();
  const values = await readSettings(db());
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageTitle title="Configurações" />
      <SettingsForm
        fields={SETTINGS.map((s) => ({
          key: s.key,
          label: s.label,
          help: s.help,
          kind: s.kind,
          group: s.group,
          min: s.min,
          max: s.max,
          step: s.step,
          value: values[s.key]!,
        }))}
        groups={SETTING_GROUPS}
        siteName={site.name}
        siteUrl={site.url}
      />
    </div>
  );
}
