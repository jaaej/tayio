import { ClipboardCheck } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { AttendanceQueue } from "./_components/attendance-queue";
import { getAttendanceQueue, parseQueueFilters } from "./_lib/queue";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ view?: string; date?: string; from?: string }>;

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("admin");
  const queue = await getAttendanceQueue(parseQueueFilters(await searchParams));

  return (
    <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
      <AttendanceQueue
        queue={queue}
        basePath="/admin/attendance"
      />
      {/* Desktop only: the marking pane's resting state. On phones the queue
          is the whole page and a lesson opens on its own route. */}
      <section
        aria-label="Marking"
        className="glass hidden min-h-[420px] flex-1 rounded-[24px] p-1.5 xl:flex"
      >
        <div className="panel flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-surface-3 text-ink-soft">
            <ClipboardCheck className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-[14px] font-semibold text-ink-soft">
            Pick a lesson to mark its attendance.
          </p>
        </div>
      </section>
    </div>
  );
}
