import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Eye } from "lucide-react";
import {
  Empty,
  GlassPanel,
  Pill,
  buttonVariants,
  type PillTone,
} from "@/components/admin/ui";
import { CurriculumLayout } from "@/components/subjects/curriculum-layout";
import {
  CurriculumRail,
  type RailWeek,
} from "@/components/subjects/curriculum-rail";
import { HomeworkCreatePanel } from "@/components/homework/homework-create-panel";
import { PdfViewerButton } from "@/components/ui/pdf-viewer";
import { VideoViewerButton } from "@/components/ui/video-viewer";
import { requireTutor } from "@/app/tutor/_data";
import { classDisplayName } from "@/lib/class-display";
import { signCurriculumUrl } from "@/lib/curriculum-storage";
import { formatDueDate } from "@/lib/format";
import { QUIZ_STATUS_LABEL, QUIZ_STATUS_TONE } from "@/lib/quiz-status";
import { getClassHub } from "../_lib/class-hub";
import {
  getTutorCurriculum,
  type TutorCurriculumWeek,
  type TutorWeekHomework,
  type TutorWeekQuiz,
} from "./_queries";
import { WeekPlanEditor } from "./_components/week-plan-editor";

type SearchParams = Promise<{ term?: string; week?: string }>;

/** Buttons on the dark admin-plan bar. */
const ON_DARK =
  "min-h-[34px] rounded-[10px] border-white/25 bg-white/10 px-3 text-[13px] text-white hover:border-white/40 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

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
  const data = await getTutorCurriculum(tutor.id, classId, termParam);
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

  return (
    <CurriculumLayout
      attached
      framed
      subjectName={data.subjectName}
      rail={
        <CurriculumRail
          basePath={`/tutor/classes/${classId}/curriculum`}
          currentTermId={data.currentTerm.id}
          terms={data.termsAvailable.map((t) => ({
            id: t.id,
            label: `${t.year} · Term ${t.termNumber}`,
          }))}
          weeks={railWeeks}
          selectedWeekId={selected?.subjectWeekId ?? null}
          currentWeekIdHint={data.currentWeekId}
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
          <AdminPlanBar
            week={selected}
            videoSignedUrl={videoSignedUrl}
            bookletSignedUrl={bookletSignedUrl}
          />

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

          <div className="flex flex-wrap items-start gap-5">
            <GlassPanel
              title="Homework"
              titleId="week-homework-heading"
              className="min-w-0 flex-[999_1_340px]"
            >
              <div className="border-b border-line p-4">
                <HomeworkCreatePanel
                  actor="tutor"
                  weekId={selected.subjectWeekId}
                  classes={[
                    { id: classId, label: classDisplayName(hub.subjectName, hub.name) },
                  ]}
                  initialClassId={classId}
                />
              </div>
              {selected.homework.length === 0 ? (
                <Empty className="py-8">No homework for this week yet.</Empty>
              ) : (
                <ul className="divide-y divide-line">
                  {selected.homework.map((h) => (
                    <HomeworkRow key={h.id} hw={h} />
                  ))}
                </ul>
              )}
            </GlassPanel>

            <GlassPanel
              title="Weekly quiz"
              titleId="week-quiz-heading"
              className="min-w-0 flex-[1_1_260px]"
            >
              <QuizCard quiz={selected.quiz} />
            </GlassPanel>
          </div>
        </div>
      )}
    </CurriculumLayout>
  );
}

/** The admin's plan for the week: one compact, read-only dark bar. */
function AdminPlanBar({
  week,
  videoSignedUrl,
  bookletSignedUrl,
}: {
  week: TutorCurriculumWeek;
  videoSignedUrl: string | null;
  bookletSignedUrl: string | null;
}) {
  const objectives = (week.objectives ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <section
      aria-labelledby="admin-plan-heading"
      className="flex flex-col gap-3 rounded-[22px] bg-ink px-[18px] py-4 text-white"
    >
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h2 id="admin-plan-heading" className="text-[16px] font-extrabold">
          Week {week.weekNumber} · {week.title}
        </h2>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-white/70">
          Plan from admin
        </span>
      </div>
      {week.description ? (
        <p className="whitespace-pre-wrap text-[14px] leading-[1.55] text-white/85">
          {week.description}
        </p>
      ) : (
        objectives.length === 0 && (
          <p className="text-[14px] text-white/70">No overview for this week yet.</p>
        )
      )}
      {objectives.length > 0 && (
        <ul aria-label="Goals" className="flex flex-wrap gap-1.5">
          {objectives.map((o, i) => (
            <li
              key={i}
              className="flex min-h-7 items-center gap-1.5 rounded-[14px] bg-white/10 px-2.5 py-1 text-[12px] font-semibold"
            >
              <Check className="h-3 w-3 shrink-0 text-[#7EE2B0]" strokeWidth={3} aria-hidden />
              {o}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2 border-t border-white/[0.14] pt-3">
        {videoSignedUrl ? (
          <VideoViewerButton url={videoSignedUrl} title={`Week ${week.weekNumber} recording`} className={ON_DARK}>
            Recorded lesson
          </VideoViewerButton>
        ) : (
          <MissingMaterial>Recorded lesson · not uploaded yet</MissingMaterial>
        )}
        {bookletSignedUrl ? (
          <PdfViewerButton url={bookletSignedUrl} title={`Week ${week.weekNumber} booklet`} className={ON_DARK}>
            Week booklet
          </PdfViewerButton>
        ) : (
          <MissingMaterial>Week booklet · not uploaded yet</MissingMaterial>
        )}
      </div>
    </section>
  );
}

function MissingMaterial({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex min-h-[34px] items-center rounded-[10px] border border-dashed border-white/30 px-3 text-[13px] font-semibold text-white/70">
      {children}
    </span>
  );
}

function HomeworkRow({ hw }: { hw: TutorWeekHomework }) {
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
    <li className="flex items-center gap-2.5 px-4 py-3">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[14px] font-bold text-ink">{hw.title}</span>
        <span className="text-[12px] text-muted">{meta}</span>
      </span>
      <span
        role="img"
        aria-label={`${pct}% handed in`}
        className="hidden h-1.5 w-16 shrink-0 overflow-hidden rounded-[3px] bg-surface-3 sm:block"
      >
        <span className="block h-full bg-ink" style={{ width: `${pct}%` }} />
      </span>
      <Link
        href={`/tutor/homework/${hw.id}`}
        className={buttonVariants({
          variant: hw.toMark > 0 ? "primary" : "outline",
          size: "sm",
          className: "shrink-0",
        })}
      >
        {hw.toMark > 0 ? `Mark ${hw.toMark}` : "Open"}
      </Link>
    </li>
  );
}

function QuizCard({ quiz }: { quiz: TutorWeekQuiz | null }) {
  if (!quiz) {
    return <Empty className="py-8">No quiz for this week.</Empty>;
  }
  const mine = quiz.assignedToMe;
  const action =
    mine && quiz.status === "requested"
      ? "Write quiz"
      : mine && quiz.status === "changes_requested"
        ? "Fix quiz"
        : mine && quiz.status === "draft"
          ? "Continue quiz"
          : "View quiz";
  const showNote =
    mine &&
    quiz.note?.trim() &&
    (quiz.status === "requested" || quiz.status === "changes_requested");
  return (
    <div className="flex flex-col gap-2.5 p-4">
      <Pill
        tone={(QUIZ_STATUS_TONE[quiz.status] ?? "default") as PillTone}
        className="h-[22px] self-start px-2 text-[11px]"
      >
        {QUIZ_STATUS_LABEL[quiz.status] ?? quiz.status}
      </Pill>
      <span className="text-[14px] font-extrabold text-ink">{quiz.title}</span>
      {showNote ? (
        <p className="whitespace-pre-wrap text-[13px] leading-[1.45] text-ink-soft">
          Admin: {quiz.note}
        </p>
      ) : (
        <span className="text-[13px] text-muted">
          {quiz.questionCount} {quiz.questionCount === 1 ? "question" : "questions"}
        </span>
      )}
      <Link
        href={`/tutor/quizzes/${quiz.id}`}
        className={buttonVariants({
          variant: action === "View quiz" ? "outline" : "primary",
          size: "md",
          className: "w-full",
        })}
      >
        {action}
      </Link>
    </div>
  );
}
