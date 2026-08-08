import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardHead, CardBody } from "@/components/student/card";
import {
  createClassAnnouncement,
  deleteClassAnnouncement,
} from "@/app/tutor/_actions";
import { getClassAnnouncementsForTutor } from "@/app/tutor/_data";
import { requireRole } from "@/lib/auth";
import { signCurriculumUrl } from "@/lib/curriculum-storage";
import { relativeTime } from "@/lib/format";
import { getTutorCurriculum } from "./_queries";
import { CurriculumLayout } from "@/components/subjects/curriculum-layout";
import {
  CurriculumRail,
  type RailWeek,
} from "@/components/subjects/curriculum-rail";
import { SectionEditor } from "./_components/section-editor";

type SearchParams = Promise<{ term?: string; week?: string }>;

export default async function TutorClassCurriculumPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const user = await requireRole("tutor");
  const { id: classId } = await params;
  const { term: termParam, week: weekParam } = await searchParams;

  const data = await getTutorCurriculum(user.id, classId, termParam);
  if (!data) notFound();

  // Class announcements live here now that the class hub is gone. Ownership is
  // already proven by getTutorCurriculum returning a row for this tutor.
  const { announcements, rosterCount } = await getClassAnnouncementsForTutor(
    user.id,
    classId,
  );

  const selected =
    data.weeks.find((w) => w.subjectWeekId === weekParam) ?? data.weeks[0];

  // Pre-sign base file URLs and attachment URLs for the selected week
  const videoSignedUrl = selected ? await signCurriculumUrl(selected.videoUrl) : null;
  const bookletSignedUrl = selected ? await signCurriculumUrl(selected.bookletUrl) : null;
  const attachmentsWithUrls = selected
    ? await Promise.all(
        selected.attachments.map(async (att) => ({
          ...att,
          url:
            att.kind === "link"
              ? att.url
              : await signCurriculumUrl(att.storagePath),
        })),
      )
    : [];

  const initial = data.subjectName.charAt(0).toUpperCase();

  const railWeeks: RailWeek[] = data.weeks.map((w) => ({
    id: w.subjectWeekId,
    weekNumber: w.weekNumber,
    title: w.title,
    topicId: w.topicId,
    topicName: w.topicName,
    pills: [
      ...(w.hasSection ? [{ label: "Notes", tone: "neutral" as const }] : []),
      ...(w.homework.length > 0
        ? [{ label: `${w.homework.length} HW`, tone: "neutral" as const }]
        : []),
    ],
  }));

  // Full-bleed layout mirroring the student subject page: bleed past the shell
  // padding, subject-tinted header, skinny rail + content that fills the rest.
  return (
    <div className="-mx-5 lg:-mx-7 -mt-6 -mb-6 lg:-mb-16 min-h-[calc(100vh-56px)] flex flex-col">
      <div className="px-5 lg:px-7 pt-2 pb-2.5 border-b border-line bg-background">
        <Link
          href="/tutor/classes"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted hover:text-ink"
        >
          ← Back to classes
        </Link>
        <div className="mt-1.5 flex items-center gap-2.5">
          <span
            aria-hidden
            className="h-9 w-9 rounded-[10px] grid place-items-center text-[17px] font-extrabold shrink-0 bg-surface-2 text-ink"
          >
            {initial}
          </span>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted font-bold">
              {data.subjectName} · {data.currentTerm.year} · Term{" "}
              {data.currentTerm.termNumber}
            </div>
            <h1 className="m-0 text-[20px] font-extrabold tracking-[-0.01em] leading-none truncate text-ink">
              {data.className} - Curriculum
            </h1>
          </div>
        </div>
      </div>

      {/* Class announcements - posted here now that the class hub is gone */}
      <div className="px-3 lg:px-4 pt-3">
        <Card className="overflow-hidden">
          <CardHead
            title="Announcements"
            action={
              <span className="text-[12px] text-muted">
                Sent to {rosterCount} student{rosterCount === 1 ? "" : "s"}
              </span>
            }
          />
          <CardBody className="space-y-4">
            <details className="group rounded-[12px] border border-line bg-surface-2">
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-[13px] font-bold text-ink [&::-webkit-details-marker]:hidden">
                Post an announcement
                <span className="text-[11px] font-semibold text-brand-600 group-open:hidden">
                  New ↓
                </span>
                <span className="hidden text-[11px] font-semibold text-muted group-open:inline">
                  Close ↑
                </span>
              </summary>
              <form
                action={createClassAnnouncement}
                className="space-y-2.5 border-t border-line px-3.5 py-3"
              >
                <input type="hidden" name="classId" value={classId} />
                <input
                  name="title"
                  required
                  maxLength={200}
                  placeholder="Title (e.g. Bring your calculator next week)"
                  className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink placeholder:text-muted focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/25"
                />
                <textarea
                  name="body"
                  required
                  rows={3}
                  maxLength={10000}
                  placeholder="Write your message to the class…"
                  className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink placeholder:text-muted focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/25"
                />
                <p className="text-[12px] text-muted">
                  Every enrolled student gets an in-app notification and sees
                  this on their dashboard.
                </p>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="h-9 rounded-full bg-brand-600 px-4 text-[12px] font-bold text-white hover:bg-brand-700"
                  >
                    Post announcement
                  </button>
                </div>
              </form>
            </details>

            {announcements.length === 0 ? (
              <p className="text-[13px] text-muted">
                No announcements posted for this class yet.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {announcements.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-[12px] border border-line bg-surface p-3.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[14px] font-bold text-ink">
                          {a.title}
                        </div>
                        <div className="text-[11px] text-muted tabular-nums mt-0.5">
                          {relativeTime(new Date(a.publishedAt))}
                        </div>
                      </div>
                      <form action={deleteClassAnnouncement} className="shrink-0">
                        <input type="hidden" name="announcementId" value={a.id} />
                        <input type="hidden" name="classId" value={classId} />
                        <button
                          type="submit"
                          className="text-[12px] font-semibold text-muted hover:text-bad"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                    <p className="mt-2 text-[13px] text-ink-soft whitespace-pre-wrap leading-snug">
                      {a.body}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {data.weeks.length === 0 ? (
        <div className="p-8 text-sm text-muted text-center">
          No curriculum has been set up for {data.subjectName} this term yet.
        </div>
      ) : (
        <CurriculumLayout
          rail={
            <CurriculumRail
              basePath={`/tutor/classes/${classId}/curriculum`}
              currentTermId={data.currentTerm.id}
              terms={data.termsAvailable.map((t) => ({
                id: t.id,
                label: `Term ${t.termNumber} · ${t.year}`,
              }))}
              weeks={railWeeks}
              selectedWeekId={selected?.subjectWeekId ?? null}
            />
          }
        >
          {selected && (
            <SectionEditor
              classId={classId}
              week={selected}
              subjectName={data.subjectName}
              topics={data.topics}
              videoSignedUrl={videoSignedUrl}
              bookletSignedUrl={bookletSignedUrl}
              attachmentsWithUrls={attachmentsWithUrls}
            />
          )}
        </CurriculumLayout>
      )}
    </div>
  );
}
