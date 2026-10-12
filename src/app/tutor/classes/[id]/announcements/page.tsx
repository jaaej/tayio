import { notFound } from "next/navigation";
import { Empty, GlassPanel, Pill, type PillTone } from "@/components/admin/ui";
import { getClassAnnouncementsForTutor, requireTutor } from "@/app/tutor/_data";
import { relativeTime } from "@/lib/format";
import { getClassHub } from "../_lib/class-hub";
import { AnnouncementCompose } from "./_components/announcement-compose";
import {
  ChangesRequested,
  DeleteAnnouncement,
} from "./_components/announcement-actions";

const STATUS: Record<string, { label: string; tone: PillTone }> = {
  pending: { label: "Awaiting approval", tone: "warn" },
  rejected: { label: "Changes requested", tone: "bad" },
  published: { label: "Published", tone: "good" },
};

export default async function TutorClassAnnouncementsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tutor = await requireTutor();
  const { id: classId } = await params;
  const hub = await getClassHub(tutor.id, classId);
  if (!hub) notFound();

  const { announcements } = await getClassAnnouncementsForTutor(tutor.id, classId);

  return (
    <div className="flex flex-wrap items-start gap-5">
      <GlassPanel
        title="Your announcements"
        titleId="class-announcements"
        meta="Admin approves each one before it is sent"
        className="min-w-0 flex-[999_1_480px]"
      >
        {announcements.length === 0 ? (
          <Empty className="py-10">No announcements for this class yet.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {announcements.map((a) => {
              const status = STATUS[a.status] ?? STATUS.pending;
              return (
                <li
                  key={a.id}
                  id={`announcement-${a.id}`}
                  className="flex flex-col gap-1.5 px-4 py-3.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[14px] font-extrabold text-ink">
                      {a.title}
                    </h3>
                    <Pill tone={status.tone} className="h-[22px] px-2 text-[11px]">
                      {status.label}
                    </Pill>
                    {a.isUrgent && (
                      <Pill tone="bad" className="h-[22px] px-2 text-[11px]">
                        Urgent
                      </Pill>
                    )}
                    {a.includeLinkedParents && (
                      <Pill className="h-[22px] px-2 text-[11px] text-ink-soft">
                        Includes parents
                      </Pill>
                    )}
                    <span className="ml-auto flex items-center gap-1">
                      <span className="text-[12px] tabular-nums text-muted">
                        {relativeTime(new Date(a.publishedAt))}
                      </span>
                      <DeleteAnnouncement
                        classId={classId}
                        announcementId={a.id}
                        title={a.title}
                      />
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-[13px] leading-normal text-ink-soft">
                    {a.body}
                  </p>
                  {a.status === "rejected" && (
                    <ChangesRequested classId={classId} announcement={a} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </GlassPanel>

      <GlassPanel
        title="New announcement"
        titleId="new-announcement"
        className="w-full min-w-0 flex-[1_1_340px] lg:max-w-[420px]"
      >
        <AnnouncementCompose classId={classId} rosterCount={hub.rosterCount} />
      </GlassPanel>
    </div>
  );
}
