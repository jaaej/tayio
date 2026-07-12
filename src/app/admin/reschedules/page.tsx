import { PageHeader } from "@/components/admin/ui";
import { RescheduleRequestList } from "@/components/reschedule/request-list";
import { requireRole } from "@/lib/auth";
import { listPendingRequests } from "@/lib/reschedule";

export default async function AdminReschedulesPage() {
  await requireRole("admin");
  const requests = await listPendingRequests({});

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        className="rise"
        eyebrow="Reschedules"
        title="Reschedule requests"
        sub="All pending reschedule requests across classes. Approve or decline below."
      />

      <RescheduleRequestList requests={requests} />
    </div>
  );
}
