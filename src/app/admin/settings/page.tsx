import { Card, CardHead, PageHeader, Pill } from "@/components/admin/ui";
import { requireUnrestrictedAdmin } from "@/lib/auth";
import { getAdminSecurityState } from "@/app/admin/_lib/actions-security";
import { AdminPinPrompt } from "@/components/admin/pin-gate";
import { PinSettingsForm } from "./_components/pin-settings-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireUnrestrictedAdmin();
  const { pinSet, unlocked } = await getAdminSecurityState();

  return (
    <div className="space-y-6 max-w-[900px]">
      <PageHeader className="rise" eyebrow="Settings" title="Settings" />

      <Card className="rise">
        <CardHead
          title="Admin PIN"
          action={
            <Pill tone={pinSet ? (unlocked ? "good" : "info") : "warn"}>
              {pinSet ? (unlocked ? "Unlocked" : "Set") : "Not set"}
            </Pill>
          }
        />
        <div className="p-5 space-y-4">
          <p className="text-[13px] text-muted">
            The PIN protects sensitive actions - viewing revenue, changing a
            user&apos;s role, and deactivating accounts. One unlock lasts about
            30 minutes.
          </p>
          {pinSet && !unlocked && (
            <AdminPinPrompt
              pinSet={pinSet}
              label="Enter admin PIN to unlock sensitive actions"
            />
          )}
          <PinSettingsForm pinSet={pinSet} />
        </div>
      </Card>
    </div>
  );
}
