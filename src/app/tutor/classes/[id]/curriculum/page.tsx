import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { signCurriculumUrl } from "@/lib/curriculum-storage";
import { colorFamilyForSubject, getAccentTokens } from "@/lib/subject-colors";
import { getTutorCurriculum } from "./_queries";
import { WeekStripTutor } from "./_components/week-strip-tutor";
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

  const tokens = getAccentTokens(colorFamilyForSubject(data.subjectName));
  const initial = data.subjectName.charAt(0).toUpperCase();

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
            className="h-9 w-9 rounded-[10px] grid place-items-center text-[17px] font-extrabold shrink-0"
            style={{ background: tokens.bgFrom, color: tokens.arrow }}
          >
            {initial}
          </span>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted font-bold">
              {data.subjectName} · {data.currentTerm.year} · Term{" "}
              {data.currentTerm.termNumber}
            </div>
            <h1
              className="m-0 text-[20px] font-extrabold tracking-[-0.01em] leading-none truncate"
              style={{ color: tokens.title }}
            >
              {data.className} — Curriculum
            </h1>
          </div>
        </div>
      </div>

      {data.weeks.length === 0 ? (
        <div className="p-8 text-sm text-muted text-center">
          No curriculum has been set up for {data.subjectName} this term yet.
        </div>
      ) : (
        <div className="flex-1 grid lg:grid-cols-[248px_minmax(0,1fr)] gap-3 lg:gap-4 px-3 lg:px-4 py-3 items-start">
          <WeekStripTutor
            classId={classId}
            currentTermId={data.currentTerm.id}
            termsAvailable={data.termsAvailable}
            weeks={data.weeks.map((w) => ({
              subjectWeekId: w.subjectWeekId,
              weekNumber: w.weekNumber,
              title: w.title,
              topicId: w.topicId,
              topicName: w.topicName,
              hasSection: w.hasSection,
              homeworkCount: w.homework.length,
            }))}
            selectedWeekId={selected?.subjectWeekId ?? null}
            accent={tokens}
          />
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
        </div>
      )}
    </div>
  );
}
