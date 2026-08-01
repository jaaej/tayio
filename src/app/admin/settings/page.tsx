import { Card, CardHead, PageHeader, Pill } from "@/components/admin/ui";
import { requireUnrestrictedAdmin } from "@/lib/auth";
import { getAdminSecurityState } from "@/app/admin/_lib/actions-security";
import { PinSettingsForm } from "./_components/pin-settings-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireUnrestrictedAdmin();
  const { pinSet } = await getAdminSecurityState();

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
    </div>
  );
}
