import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { Empty, GlassPanel, Pill, type PillTone } from "@/components/admin/ui";
import { CurriculumLayout } from "@/components/subjects/curriculum-layout";
import {
  CurriculumRail,
  type RailWeek,
} from "@/components/subjects/curriculum-rail";
import {
  MATERIAL_BUTTON,
  MATERIAL_BUTTON_QUIET,
  MaterialCard,
  MaterialNotReady,
} from "@/components/subjects/material-card";
import { WeekOverview } from "@/components/subjects/week-overview";
import { HomeworkCreatePanel } from "@/components/homework/homework-create-panel";
import { PdfViewerButton } from "@/components/ui/pdf-viewer";
import { VideoViewerButton } from "@/components/ui/video-viewer";
import { requireTutor } from "@/app/tutor/_data";
import { classDisplayName } from "@/lib/class-display";
import { signCurriculumUrl } from "@/lib/curriculum-storage";
import { formatDueDate } from "@/lib/format";
import { QUIZ_STATUS_LABEL, QUIZ_STATUS_TONE } from "@/lib/quiz-status";
import { subjectTone } from "@/lib/subject-tone";
import { cn } from "@/lib/utils";
import { ClassHero } from "../_components/class-hero";
import { getClassHub } from "../_lib/class-hub";
import {
  getTutorCurriculum,
  type TutorWeekHomework,
  type TutorWeekQuiz,
} from "./_queries";
import { WeekPlanEditor } from "./_components/week-plan-editor";
import { quizNotes } from "@/lib/quiz-notes";

type SearchParams = Promise<{ term?: string; week?: string }>;

export default async function TutorClassCurriculumPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const tutor = await requireTutor();
  const { id: classId } = await params;
  const { term: termParam, week: weekParam } = await searchParams;

  const hub = await getClassHub(tutor.id, classId);
  if (!hub) notFound();
  const data = await getTutorCurriculum(tutor.id, classId, termParam, weekParam);
  if (!data) notFound();

  const selected =
    data.weeks.find((w) => w.subjectWeekId === weekParam) ??
    data.weeks.find((w) => w.subjectWeekId === data.currentWeekId) ??
    data.weeks[0];

  const [videoSignedUrl, bookletSignedUrl, attachments] = selected
    ? await Promise.all([
        signCurriculumUrl(selected.videoUrl),
        signCurriculumUrl(selected.bookletUrl),
        Promise.all(
          selected.attachments.map(async (att) => ({
            ...att,
            href:
              att.kind === "link"
                ? att.url
                : await signCurriculumUrl(att.storagePath),
          })),
        ),
      ])
    : [null, null, []];

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
      ...(w.quiz?.assignedToMe &&
      (w.quiz.status === "requested" || w.quiz.status === "changes_requested")
        ? [{ label: "Quiz to do", tone: "warn" as const }]
        : []),
    ],
  }));

  const tone = subjectTone(data.subjectName, data.subjectColor);
  const className = classDisplayName(hub.subjectName, hub.name);

  return (
    <>
      <ClassHero
        hub={hub}
        tutorId={tutor.id}
        title={selected?.title}
        kicker={selected ? `${className} · Week ${selected.weekNumber}` : undefined}
      />
      <CurriculumLayout
        attached
        framed
        defaultOpen
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
            currentWeekIdHint={data.currentWeekId}
            accent={tone.flat}
          />
        }
      >
        {!selected ? (
          <GlassPanel>
            <Empty className="py-12">
              No curriculum has been set up for {data.subjectName} in Term{" "}
              {data.currentTerm.termNumber}, {data.currentTerm.year} yet.
            </Empty>
          </GlassPanel>
        ) : (
          <div className="flex min-w-0 flex-col gap-5">
            <WeekOverview
              subjectName={data.subjectName}
              subjectColor={data.subjectColor}
              description={selected.description}
              objectives={selected.objectives}
              emptyText="No overview for this week yet."
              note="Set by admin"
            />

            <section
              aria-labelledby="lm-h"
              className="glass flex flex-col gap-1.5 rounded-[24px] p-1.5"
            >
              <h2 id="lm-h" className="m-0 px-3 pb-1 pt-2 text-[16px] font-extrabold text-ink">
                Lesson &amp; materials
              </h2>
              <div className="grid gap-1.5 sm:grid-cols-2">
                <MaterialCard
                  kind="video"
                  title="Recorded lesson"
                  status={videoSignedUrl ? "Uploaded" : "Not uploaded yet"}
                  statusTone={videoSignedUrl ? "done" : "waiting"}
                >
                  {videoSignedUrl ? (
                    <span className="flex w-full rounded-[12px] transition-opacity hover:opacity-90" style={{ background: tone.flat }}>
                      <VideoViewerButton
                        url={videoSignedUrl}
                        title={`Week ${selected.weekNumber} recording`}
                        className={VIEW_BUTTON}
                      >
                        Watch
                      </VideoViewerButton>
                    </span>
                  ) : (
                    <MaterialNotReady />
                  )}
                </MaterialCard>
                <MaterialCard
                  kind="booklet"
                  title="Week booklet"
                  status={bookletSignedUrl ? "Uploaded" : "Not uploaded yet"}
                  statusTone={bookletSignedUrl ? "done" : "waiting"}
                >
                  {bookletSignedUrl ? (
                    <span className="flex w-full rounded-[12px] transition-opacity hover:opacity-90" style={{ background: tone.flat }}>
                      <PdfViewerButton
                        url={bookletSignedUrl}
                        title={`Week ${selected.weekNumber} booklet`}
                        className={VIEW_BUTTON}
                      >
                        Open booklet
                      </PdfViewerButton>
                    </span>
                  ) : (
                    <MaterialNotReady />
                  )}
                </MaterialCard>
              </div>
            </section>

            <GlassPanel
              title="For students this week"
              titleId="week-plan-heading"
              action={
                <span className="flex items-center gap-1.5 pr-1.5 text-[12px] font-bold text-ink-soft">
                  <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Students and parents see this on the week and its lessons
                </span>
              }
            >
              <WeekPlanEditor
                key={selected.subjectWeekId}
                classId={classId}
                subjectWeekId={selected.subjectWeekId}
                initialBody={selected.note ?? ""}
                attachments={attachments}
                topics={data.topics}
              />
            </GlassPanel>

            <div
              className={
                selected.quiz ? "grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]" : undefined
              }
            >
              <section
                aria-labelledby="hw-h"
                className="glass flex min-w-0 flex-col gap-1.5 rounded-[24px] p-1.5"
              >
                <h2 id="hw-h" className="m-0 px-3 pb-1 pt-2 text-[16px] font-extrabold text-ink">
                  Homework
                </h2>
                <div className="panel overflow-hidden">
                  <div className="border-b border-[#EFF0F5] px-4 py-3">
                    <HomeworkCreatePanel
                      actor="tutor"
                      weekId={selected.subjectWeekId}
                      classes={[{ id: classId, label: className }]}
                      initialClassId={classId}
                    />
                  </div>
                  {selected.homework.length === 0 ? (
                    <p className="px-4 py-6 text-center text-[14px] text-[#5E5A73]">
                      No homework this week.
                    </p>
                  ) : (
                    <ul className="m-0 list-none divide-y divide-[#EFF0F5] p-0">
                      {selected.homework.map((h) => (
                        <HomeworkRow key={h.id} hw={h} accent={tone.flat} />
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              {selected.quiz && <QuizCard quiz={selected.quiz} accent={tone.flat} />}
            </div>
          </div>
        )}
      </CurriculumLayout>
    </>
  );
}

/** A viewer button inside a span filled with the subject colour (the viewer
 *  buttons take a class, not a style). */
const VIEW_BUTTON = cn(
  MATERIAL_BUTTON,
  "min-h-10 gap-2 rounded-[12px] border-0 bg-transparent px-3.5 text-[14px] font-extrabold text-white hover:border-0 hover:bg-transparent",
);

/** Pill button at the end of a homework or quiz row. */
const ROW_BUTTON =
  "flex h-9 shrink-0 items-center rounded-[11px] px-3.5 text-[13px] font-extrabold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";

function HomeworkRow({ hw, accent }: { hw: TutorWeekHomework; accent: string }) {
  const pct = hw.assigned > 0 ? Math.round((hw.handedIn / hw.assigned) * 100) : 0;
  const meta = [
    hw.isTest ? "Test" : null,
    `Due ${formatDueDate(hw.dueDate)}`,
    `${hw.handedIn} of ${hw.assigned} in`,
    hw.toMark > 0 ? `${hw.toMark} to mark` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-extrabold text-ink">{hw.title}</span>
        <span className="truncate text-[13px] font-medium text-[#5E5A73]">{meta}</span>
      </span>
      <span
        role="img"
        aria-label={`${pct}% handed in`}
        className="hidden h-1.5 w-16 shrink-0 overflow-hidden rounded-[3px] bg-surface-3 sm:block"
      >
        <span className="block h-full" style={{ width: `${pct}%`, background: accent }} />
      </span>
      <Link
        href={`/tutor/homework/${hw.id}`}
        className={cn(
          ROW_BUTTON,
          hw.toMark > 0 ? "text-white hover:opacity-90" : MATERIAL_BUTTON_QUIET,
        )}
        style={hw.toMark > 0 ? { background: accent } : undefined}
      >
        {hw.toMark > 0 ? `Mark ${hw.toMark}` : "Open"}
      </Link>
    </li>
  );
}

/** The week's quiz; weeks without one show no card, as for students. */
function QuizCard({ quiz, accent }: { quiz: TutorWeekQuiz; accent: string }) {
  const mine = quiz.assignedToMe;
  const action =
    mine && quiz.status === "requested"
      ? "Write quiz"
      : mine && quiz.status === "changes_requested"
        ? "Fix quiz"
        : mine && quiz.status === "draft"
          ? "Continue quiz"
          : "View quiz";
  // The admin's brief and the latest change request, labelled as on the
  // quiz page, while the quiz is this tutor's to write or fix.
  const notes =
    mine && (quiz.status === "requested" || quiz.status === "changes_requested")
      ? quizNotes(quiz)
      : [];
  return (
    <section
      aria-labelledby="qz-h"
      className="glass flex min-w-0 flex-col gap-1.5 self-start rounded-[24px] p-1.5"
    >
      <h2 id="qz-h" className="m-0 px-3 pb-1 pt-2 text-[16px] font-extrabold text-ink">
        Weekly quiz
      </h2>
      <div className="panel flex flex-col gap-3 px-4 py-3.5">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-[15px] font-extrabold text-ink [overflow-wrap:anywhere]">
            {quiz.title}
          </span>
          {notes.length > 0 ? (
            notes.map((note) => (
              <span
                key={note.key}
                className="whitespace-pre-wrap text-[13px] leading-[1.45] text-[#5E5A73]"
              >
                <strong className={note.tone === "bad" ? "font-extrabold text-bad" : "font-extrabold text-ink"}>
                  {note.label}
                  {note.date && ` · ${note.date}`}:
                </strong>{" "}
                {note.text}
              </span>
            ))
          ) : (
            <span className="text-[13px] font-medium text-[#5E5A73]">
              {quiz.questionCount} {quiz.questionCount === 1 ? "question" : "questions"}
            </span>
          )}
        </span>
        <Pill
          tone={(QUIZ_STATUS_TONE[quiz.status] ?? "default") as PillTone}
          className="self-start"
        >
          {QUIZ_STATUS_LABEL[quiz.status] ?? quiz.status}
        </Pill>
        <Link
          href={`/tutor/quizzes/${quiz.id}`}
          className={cn(
            MATERIAL_BUTTON,
            action === "View quiz" ? MATERIAL_BUTTON_QUIET : "text-white hover:opacity-90",
          )}
          style={action === "View quiz" ? undefined : { background: accent }}
        >
          {action}
        </Link>
      </div>
    </section>
  );
}
