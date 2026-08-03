import Link from "next/link";
import {
  ClipboardCheck,
  BookOpen,
  SquarePen,
  ChevronRight,
} from "lucide-react";
import { Card, CardHead, CardBody } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { Pill } from "@/components/student/pill";
import { formatDateLong, formatTime } from "@/lib/format";
import { getClassHubForTutor, requireTutor } from "../../_data";
import { LessonPlanEditor } from "./_components/lesson-plan-editor";

const WEEKDAY = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default async function TutorClassHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tutor = await requireTutor();
  const { class: cls, nextLesson, isToday, roster } =
    await getClassHubForTutor(tutor.id, id);

  const scheduleChip =
    typeof cls.weekday === "number" && cls.startTime && cls.endTime
      ? `${WEEKDAY[cls.weekday]} · ${formatTime(cls.startTime)}–${formatTime(cls.endTime)}`
      : "No recurring slot";

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow={`${cls.subjectName}${cls.subjectYear ? ` · ${cls.subjectYear}` : ""}`}
        title={cls.name}
        sub={
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
            <span>{scheduleChip}</span>
            {cls.location && <span>{cls.location}</span>}
            <span>
              {roster.length} student{roster.length === 1 ? "" : "s"}
            </span>
          </div>
        }
      />

      {/* This lesson - the one-tap attendance entry */}
      {nextLesson ? (
        <Link href={`/tutor/lessons/${nextLesson.id}`} className="block group">
          <Card
            className={`overflow-hidden transition-all duration-150 group-hover:-translate-y-[3px] group-hover:shadow-[0_14px_28px_-16px_rgba(31,40,90,0.5)] ${isToday ? "border-brand-300" : ""}`}
          >
            <CardBody>
              <div className="flex items-center gap-4">
                <span className="grid place-items-center h-11 w-11 rounded-[12px] bg-brand-100 text-brand-700 shrink-0">
                  <ClipboardCheck
                    className="h-[22px] w-[22px]"
                    strokeWidth={2.2}
                    aria-hidden
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-[0.14em] font-bold text-muted">
                      {isToday ? "Today's class" : "Next class"}
                    </span>
                    {isToday && <Pill tone="brand">Now</Pill>}
                  </div>
                  <div className="text-[15px] font-extrabold text-ink leading-tight mt-0.5">
                    {formatDateLong(nextLesson.date)} ·{" "}
                    <span className="tabular-nums">
                      {formatTime(nextLesson.startTime)}–
                      {formatTime(nextLesson.endTime)}
                    </span>
                  </div>
                  <div className="text-[12px] text-muted mt-0.5">
                    {isToday
                      ? "Open to mark attendance and write notes"
                      : "Open the lesson"}
                  </div>
                </div>
                <span className="text-[13px] font-bold text-brand-700 shrink-0">
                  View class →
                </span>
              </div>
            </CardBody>
          </Card>
        </Link>
      ) : (
        <Card>
          <CardBody>
            <div className="text-[11px] uppercase tracking-[0.12em] text-muted font-bold">
              No upcoming lessons
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              There are no scheduled lessons ahead for this class.
            </p>
          </CardBody>
        </Card>
      )}

      {/* Lesson plan - forward-looking, visible to students + parents */}
      <Card className="overflow-hidden">
        <CardHead
          title="Lesson plan"
          action={<span className="text-[12px] text-muted">What's coming up</span>}
        />
        <CardBody>
          <LessonPlanEditor classId={cls.id} initial={cls.lessonPlan ?? ""} />
        </CardBody>
      </Card>

      {/* Curriculum + Homework */}
      <div className="grid sm:grid-cols-2 gap-3.5">
        <Link
          href={`/tutor/classes/${cls.id}/curriculum`}
          className="block group"
        >
          <Card className="h-full transition-all duration-150 group-hover:-translate-y-[3px] group-hover:border-brand-200">
            <CardBody>
              <div className="flex items-center gap-3">
                <span className="grid place-items-center h-10 w-10 rounded-[10px] bg-surface-2 text-brand-700">
                  <BookOpen
                    className="h-[18px] w-[18px]"
                    strokeWidth={2.2}
                    aria-hidden
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold text-ink">
                    Curriculum
                  </div>
                  <div className="text-[12px] text-muted">
                    Weekly content, resources, and quizzes
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
              </div>
            </CardBody>
          </Card>
        </Link>
        <Link href="/tutor/homework" className="block group">
          <Card className="h-full transition-all duration-150 group-hover:-translate-y-[3px] group-hover:border-brand-200">
            <CardBody>
              <div className="flex items-center gap-3">
                <span className="grid place-items-center h-10 w-10 rounded-[10px] bg-surface-2 text-brand-700">
                  <SquarePen
                    className="h-[18px] w-[18px]"
                    strokeWidth={2.2}
                    aria-hidden
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold text-ink">Homework</div>
                  <div className="text-[12px] text-muted">
                    Set and mark homework
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
              </div>
            </CardBody>
          </Card>
        </Link>
      </div>

      {/* Students */}
      <Card className="overflow-hidden">
        <CardHead
          title="Students"
          action={
            <span className="text-[12px] text-muted">
              {roster.length} enrolled
            </span>
          }
        />
        {roster.length === 0 ? (
          <CardBody>
            <p className="text-sm text-muted">No students enrolled yet.</p>
          </CardBody>
        ) : (
          <ul className="divide-y divide-line">
            {roster.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/tutor/students/${s.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2 transition-colors"
                >
                  <span className="text-[13px] font-bold text-ink">
                    {s.firstName} {s.lastName}
                  </span>
                  <span className="flex items-center gap-2 text-[12px] text-muted">
                    {s.yearLevel && <span>Yr {s.yearLevel}</span>}
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
