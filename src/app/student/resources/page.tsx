import Link from "next/link";
import { Card } from "@/components/student/card";
import { StatusBadge } from "@/components/data/status-badge";
import { requireRole } from "@/lib/auth";
import { formatDateLong, formatTime } from "@/lib/format";
import { LESSON_STATUS_LABEL, LESSON_STATUS_STYLE } from "@/lib/status";
import { getStudentLessonsWithNotes } from "../_lib/queries";
import { PageHead } from "@/components/student/page-head";
import { SectionHeader } from "../_components/section-header";
import { Tabs, type TabItem } from "./_components/tabs";
import { LibraryBrowser } from "./_components/library-browser";

export default async function ResourcesIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireRole("student");
  const { tab } = await searchParams;
  const activeTab: "library" | "lessons" = tab === "lessons" ? "lessons" : "library";

  const tabs: TabItem[] = [
    { label: "Library", href: "/student/resources", active: activeTab === "library" },
    {
      label: "Recorded lessons",
      href: "/student/resources?tab=lessons",
      active: activeTab === "lessons",
    },
  ];

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Resources"
        title="Your resources"
        sub="Class booklets and worksheets, plus recaps from past lessons."
      />

      <Tabs items={tabs} />

      {activeTab === "library" ? (
        <LibraryBrowser studentId={user.id} />
      ) : (
        <RecordedLessonsTab studentId={user.id} />
      )}
    </div>
  );
}

async function RecordedLessonsTab({ studentId }: { studentId: string }) {
  const lessons = await getStudentLessonsWithNotes(studentId);

  return (
    <Card className="overflow-hidden">
      <SectionHeader title="Recorded lessons" right={`${lessons.length} total`} />
      {lessons.length === 0 ? (
        <div className="px-4 py-8 text-sm text-muted">No lessons yet.</div>
      ) : (
        <ul className="divide-y divide-line">
          {lessons.map((l) => (
            <li key={l.lessonId}>
              <Link
                href={`/student/resources/${l.lessonId}`}
                className="grid grid-cols-1 md:grid-cols-[12rem_1fr_auto_auto] gap-3 md:gap-6 px-4 py-4 items-baseline hover:bg-brand-50/60 transition-colors"
              >
                <div>
                  <div className="text-sm text-ink">
                    {formatDateLong(l.date)}
                  </div>
                  <div className="text-xs text-muted tabular-nums">
                    {formatTime(l.startTime)}
                  </div>
                </div>
                <div className="text-sm text-ink-soft">
                  {l.subjectName}
                  <span className="text-muted"> · {l.className}</span>
                </div>
                <div className="md:justify-self-end">
                  <StatusBadge
                    label={LESSON_STATUS_LABEL[l.status] ?? l.status}
                    className={LESSON_STATUS_STYLE[l.status]}
                  />
                </div>
                <div className="md:justify-self-end text-xs text-right space-y-0.5">
                  {l.recordingUrl && (
                    <div className="font-semibold text-brand-700">
                      ▶ Recording
                    </div>
                  )}
                  <div className={l.hasNote ? "text-brand-700" : "text-muted"}>
                    {l.hasNote ? "Recap ready →" : "No recap yet"}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
