import { GlassPanel, PageHeader, Pill } from "@/components/admin/ui";
import { requireUnrestrictedAdmin } from "@/lib/auth";
import { getAdminSecurityState } from "@/app/admin/_lib/actions-security";
import { PinSettingsForm } from "./_components/pin-settings-form";
import { SubjectAliasesForm } from "./_components/subject-aliases-form";
import { getSubjectSearchAliases } from "@/lib/subject-search-aliases";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireUnrestrictedAdmin();
  const [{ pinSet }, subjectAliases] = await Promise.all([
    getAdminSecurityState(),
    getSubjectSearchAliases(),
  ]);

  return (
    <div className="flex max-w-[980px] flex-col gap-5">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2.5">
            Settings
            <span className="inline-flex h-[22px] items-center rounded-full bg-white px-2 text-[11px] font-extrabold uppercase tracking-[0.04em] text-ink">
              Owner only
            </span>
          </span>
        }
      />

      <GlassPanel
        title="Admin PIN"
        titleId="settings-pin"
        action={
          <Pill tone={pinSet ? "good" : "warn"} className="mr-1.5">
            {pinSet ? "Set" : "Not set"}
          </Pill>
        }
      >
        <div className="flex flex-col gap-4 p-[18px]">
          <p className="text-[13px] leading-relaxed text-muted">
            Reception admins must enter this PIN to see revenue figures and
            payment totals. You are never asked for it. One unlock lasts about
            30 minutes.
          </p>
          <PinSettingsForm pinSet={pinSet} />
        </div>
      </GlassPanel>

      <GlassPanel title="User search shortcuts" titleId="settings-shortcuts">
        <p className="border-b border-line px-4 py-3.5 text-[13px] leading-relaxed text-muted">
          Type a shortcut like <strong className="text-ink">e1/2</strong> in
          the user search to find everyone studying or teaching that subject.
          Full subject and class names still work.
        </p>
        <SubjectAliasesForm subjects={subjectAliases} />
      </GlassPanel>
    </div>
  );
}
