import { Card, CardHead, PageHeader, Pill } from "@/components/admin/ui";
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
    <div className="space-y-6">
      <PageHeader className="rise" eyebrow="Settings" title="Settings" />

      <Card className="rise">
        <CardHead
          title="Admin PIN"
          action={
            <Pill tone={pinSet ? "good" : "warn"}>
              {pinSet ? "Set" : "Not set"}
            </Pill>
          }
        />
        <div className="p-5 space-y-4">
          <p className="text-[13px] text-muted">
            The PIN gates reception staff from the Revenue page - they must enter
            it to view financial figures. You (the owner) are never asked for it;
            set or change it here. One reception unlock lasts about 30 minutes.
          </p>
          <PinSettingsForm pinSet={pinSet} />
        </div>
      </Card>

      <Card className="rise">
        <CardHead title="User search shortcuts" />
        <div className="border-b border-line px-5 py-4">
          <p className="max-w-3xl text-[13px] leading-5 text-muted">
            Assign a short key to a subject, such as <strong>e1/2</strong>.
            Typing that exact key in Admin Users will find everyone studying or
            teaching the subject. The full subject and class names continue to
            work normally.
          </p>
        </div>
        <SubjectAliasesForm subjects={subjectAliases} />
      </Card>
    </div>
  );
}
