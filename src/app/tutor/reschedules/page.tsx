import { PageHead } from "@/components/student/page-head";
import { RescheduleRequestList } from "@/components/reschedule/request-list";
import { requireRole } from "@/lib/auth";
import { listPendingRequests } from "@/lib/reschedule";

export default async function TutorReschedulesPage() {
  const user = await requireRole("tutor");
  const requests = await listPendingRequests({ tutorId: user.id });

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Reschedule requests"
        title={`${requests.length} ${requests.length === 1 ? "request" : "requests"} pending`}
        sub="Approve or decline reschedule requests from students in your classes."
      />

      <RescheduleRequestList requests={requests} />
    </div>
  );
}
