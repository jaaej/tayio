import Link from "next/link";
import { subjectTone } from "@/lib/subject-tone";
import { cn } from "@/lib/utils";
import type { DashboardSubject } from "../_lib/dashboard";

/**
 * One card per subject, each a link to that subject's weeks. Subjects carry
 * their own colour as a pale fill; only the subject on now or next is the
 * saturated version, so the colour says "this one is next" instead of
 * decorating every card equally.
 */
export function SubjectCards({ subjects }: { subjects: DashboardSubject[] }) {
  if (subjects.length === 0) {
    return (
      <div className="glass rounded-[24px] p-1.5">
        <p className="panel px-5 py-8 text-center text-[14px] text-muted">
          You&apos;re not in any classes yet. Your subjects appear here once you&apos;re enrolled.
        </p>
      </div>
    );
  }
  return (
    <ul
      aria-label="Your subjects"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]"
    >
      {subjects.map((subject) => (
        <li key={subject.subjectId} className="min-w-0">
          <SubjectCard subject={subject} />
        </li>
      ))}
    </ul>
  );
}

function SubjectCard({ subject }: { subject: DashboardSubject }) {
  const tone = subjectTone(subject.subjectName);
  const solid = subject.featured;
  return (
    <Link
      href={`/student/subjects/${subject.subjectId}`}
      style={
        solid
          ? { backgroundColor: tone.solid }
          : { backgroundColor: tone.bg, color: tone.fg }
      }
      className={cn(
        "flex h-full flex-col rounded-[22px] p-5 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-[#e6e8f6]",
        solid
          ? "text-white shadow-[0_14px_32px_-12px_rgba(23,21,43,0.45)] hover:shadow-[0_20px_40px_-14px_rgba(23,21,43,0.5)]"
          : "shadow-[0_1px_2px_rgba(23,21,43,0.06)] hover:shadow-[0_14px_30px_-16px_rgba(23,21,43,0.35)]",
      )}
    >
      <h2 className="text-[19px] font-extrabold leading-tight tracking-[-0.015em]">
        {subject.subjectName}
      </h2>
      <p className={cn("mt-0.5 text-[13px] font-semibold", solid ? "text-white/90" : "opacity-80")}>
        {subject.tutorName}
      </p>

      {subject.thisWeek && (
        <p className="mt-4 text-[14px] leading-snug">
          <span className={solid ? "text-white/90" : "opacity-80"}>This week: </span>
          <span className="font-bold">{subject.thisWeek}</span>
        </p>
      )}

      {/* The featured card says why it leads: its next lesson is the biggest
          thing on it. Pale cards keep it as a quiet footnote. */}
      <p
        className={cn(
          "mt-auto pt-4 font-extrabold",
          solid ? "text-[18px] tracking-[-0.01em]" : "text-[13px]",
        )}
      >
        {subject.nextLesson}
      </p>
    </Link>
  );
}
