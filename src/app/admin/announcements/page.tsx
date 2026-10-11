import { desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ChevronDown } from "lucide-react";
import { db } from "@/db/client";
import {
  announcementRecipients,
  announcements,
  classes,
  profiles,
  subjects,
} from "@/db/schema";
import { Empty, GlassPanel, PageHeader, Pill } from "@/components/admin/ui";
import { classDisplayName } from "@/lib/class-display";
import {
  ANNOUNCEMENT_ROLES,
  targetSummary,
  type AnnouncementTargetRules,
} from "@/lib/announcement-rules";
import { CreateAnnouncementForm } from "./_components/create-announcement-form";
import { AnnouncementReviewActions } from "./_components/announcement-review-actions";
import { DeleteAnnouncementButton } from "./_components/delete-announcement-button";

export const dynamic = "force-dynamic";

// Title row of a glass bezel whose body is several panels, matching GlassPanel.
const BEZEL_HEAD =
  "flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 py-1.5 pl-3 pr-1.5";
const BEZEL_TITLE = "text-[16px] font-extrabold text-ink";

export default async function AnnouncementsPage() {
  const author = alias(profiles, "author");

  const [rows, subjectRows, classRows, tutorRows, profileYears] =
    await Promise.all([
      db
        .select({
          id: announcements.id,
          title: announcements.title,
          body: announcements.body,
          audienceRole: announcements.audienceRole,
          audienceClassId: announcements.audienceClassId,
          status: announcements.status,
          isUrgent: announcements.isUrgent,
          targetRoles: announcements.targetRoles,
          targetSubjectIds: announcements.targetSubjectIds,
          targetYearLevels: announcements.targetYearLevels,
          targetClassIds: announcements.targetClassIds,
          targetTutorIds: announcements.targetTutorIds,
          includeLinkedParents: announcements.includeLinkedParents,
          rejectedReason: announcements.rejectedReason,
          publishedAt: announcements.publishedAt,
          authorFirst: author.firstName,
          authorLast: author.lastName,
          className: classes.name,
          recipientCount: sql<number>`(
            select count(*)::int from ${announcementRecipients}
            where ${announcementRecipients.announcementId} = ${announcements.id}
          )`,
        })
        .from(announcements)
        .innerJoin(author, eq(author.id, announcements.authorId))
        .leftJoin(classes, eq(classes.id, announcements.audienceClassId))
        .orderBy(desc(announcements.publishedAt)),
      db
        .select({ id: subjects.id, name: subjects.name, yearLevel: subjects.yearLevel })
        .from(subjects)
        .orderBy(subjects.name),
      db
        .select({
          id: classes.id,
          name: classes.name,
          subjectName: subjects.name,
          tutorId: classes.tutorId,
        })
        .from(classes)
        .innerJoin(subjects, eq(subjects.id, classes.subjectId))
        .orderBy(subjects.name, classes.name),
      db
        .select({
          id: profiles.id,
          firstName: profiles.firstName,
          lastName: profiles.lastName,
        })
        .from(profiles)
        .where(eq(profiles.role, "tutor"))
        .orderBy(profiles.firstName, profiles.lastName),
      db
        .selectDistinct({ yearLevel: profiles.yearLevel })
        .from(profiles)
        .where(eq(profiles.isActive, true)),
    ]);

  const years = Array.from(
    new Set(
      [...subjectRows.map((row) => row.yearLevel), ...profileYears.map((row) => row.yearLevel)]
        .filter((value): value is string => Boolean(value?.trim()))
        .map((value) => value.trim()),
    ),
  ).sort(naturalCompare);
  const options = {
    subjects: subjectRows.map((row) => ({ id: row.id, label: row.name })),
    years,
    classes: classRows.map((row) => ({
      id: row.id,
      label: classDisplayName(row.subjectName, row.name),
    })),
    tutors: tutorRows.map((row) => ({
      id: row.id,
      label: `${row.firstName} ${row.lastName}`.trim(),
    })),
  };
  const labelMaps = {
    subjects: new Map(options.subjects.map((entry) => [entry.id, entry.label])),
    classes: new Map(options.classes.map((entry) => [entry.id, entry.label])),
    tutors: new Map(options.tutors.map((entry) => [entry.id, entry.label])),
  };
  const pendingRows = rows.filter((row) => row.status === "pending");
  const historyRows = rows.filter((row) => row.status !== "pending");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Announcements"
        actions={
          pendingRows.length > 0 ? (
            <a
              href="#awaiting-approval"
              className="inline-flex h-[34px] items-center gap-2 rounded-[11px] bg-surface px-3 text-[13px] font-bold text-ink transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <span aria-hidden className="h-2 w-2 rounded-full bg-[#E8890C]" />
              {pendingRows.length} tutor{" "}
              {pendingRows.length === 1 ? "announcement" : "announcements"} to approve
            </a>
          ) : null
        }
      />

      <div className="flex flex-wrap items-start gap-5">
        <section
          id="compose"
          aria-labelledby="compose-heading"
          className="glass relative z-10 flex min-w-0 flex-[999_1_520px] scroll-mt-5 flex-col rounded-[24px] p-1.5"
        >
          <div className={BEZEL_HEAD}>
            <h2 id="compose-heading" className={BEZEL_TITLE}>
              New announcement
            </h2>
          </div>
          <CreateAnnouncementForm options={options} />
        </section>

        <aside
          aria-label="Approvals and history"
          className="flex min-w-0 flex-[1_1_320px] flex-col gap-5 lg:max-w-[420px]"
        >
          {pendingRows.length > 0 ? (
            <section
              id="awaiting-approval"
              aria-labelledby="awaiting-approval-heading"
              className="glass flex scroll-mt-5 flex-col rounded-[24px] p-1.5"
            >
              <div className={BEZEL_HEAD}>
                <h2 id="awaiting-approval-heading" className={BEZEL_TITLE}>
                  Awaiting approval
                </h2>
                <Pill tone="warn" className="ml-auto">
                  {pendingRows.length} from {pendingRows.length === 1 ? "a tutor" : "tutors"}
                </Pill>
              </div>
              <div className="flex flex-col gap-1.5">
                {pendingRows.map((row) => (
                  <PendingCard
                    key={row.id}
                    row={row}
                    audience={describeAudience(row, labelMaps)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <GlassPanel
            title="History"
            titleId="history-heading"
          >
            {historyRows.length === 0 ? (
              <Empty>No announcements yet.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {historyRows.map((row) => (
                  <HistoryRow
                    key={row.id}
                    row={row}
                    audience={describeAudience(row, labelMaps)}
                  />
                ))}
              </ul>
            )}
          </GlassPanel>
        </aside>
      </div>
    </div>
  );
}

type AnnouncementRow = Awaited<ReturnType<typeof getRowType>>;

// A type-only helper keeps AnnouncementCard tied to the query without a second
// hand-maintained interface. It is never called at runtime.
async function getRowType() {
  return {
    id: "",
    title: "",
    body: "",
    audienceRole: null as (typeof announcements.$inferSelect)["audienceRole"],
    audienceClassId: null as string | null,
    status: "published" as (typeof announcements.$inferSelect)["status"],
    isUrgent: false,
    targetRoles: [] as string[],
    targetSubjectIds: [] as string[],
    targetYearLevels: [] as string[],
    targetClassIds: [] as string[],
    targetTutorIds: [] as string[],
    includeLinkedParents: false,
    rejectedReason: null as string | null,
    publishedAt: new Date(),
    authorFirst: "",
    authorLast: "",
    className: null as string | null,
    recipientCount: 0,
  };
}

function formatStamp(date: Date) {
  return new Date(date).toLocaleString("en-AU", {
    timeZone: "Australia/Melbourne",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function PendingCard({ row, audience }: { row: AnnouncementRow; audience: string }) {
  return (
    <article
      id={`announcement-${row.id}`}
      className="panel flex scroll-mt-5 flex-col gap-2.5 p-4"
    >
      <p className="text-[12px] font-semibold text-muted">
        {row.authorFirst} {row.authorLast} · to {audience} · {formatStamp(row.publishedAt)}
      </p>
      <h3 className="text-[15px] font-extrabold text-ink">{row.title}</h3>
      <p className="whitespace-pre-wrap text-[13px] leading-normal text-ink-soft">{row.body}</p>
      {row.isUrgent ? (
        <span>
          <Pill tone="bad">Urgent + email</Pill>
        </span>
      ) : null}
      <AnnouncementReviewActions id={row.id} />
    </article>
  );
}

function HistoryRow({ row, audience }: { row: AnnouncementRow; audience: string }) {
  const rejected = row.status === "rejected";
  return (
    <li id={`announcement-${row.id}`} className="flex scroll-mt-5 flex-col gap-1.5 px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill tone={rejected ? "bad" : "good"}>{rejected ? "Rejected" : "Published"}</Pill>
        {row.isUrgent ? <Pill tone="bad">Urgent + email</Pill> : null}
        <span className="ml-auto text-[12px] tabular-nums text-muted">
          {formatStamp(row.publishedAt)}
        </span>
      </div>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start gap-1.5 rounded-[6px] text-[14px] font-extrabold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1 break-words">{row.title}</span>
          <ChevronDown
            className="mt-0.5 h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-normal text-ink-soft">
          {row.body}
        </p>
      </details>
      {row.rejectedReason ? (
        <p className="rounded-[10px] bg-bad-bg px-3 py-2 text-[12px] text-bad">
          Rejection reason: {row.rejectedReason}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-[12px] text-muted">
          {audience}
          {row.status === "published"
            ? ` · ${row.recipientCount} ${row.recipientCount === 1 ? "recipient" : "recipients"}`
            : ""}
          {` · by ${row.authorFirst} ${row.authorLast}`}
        </p>
        <DeleteAnnouncementButton id={row.id} title={row.title} />
      </div>
    </li>
  );
}

function describeAudience(
  row: AnnouncementRow,
  labels: {
    subjects: Map<string, string>;
    classes: Map<string, string>;
    tutors: Map<string, string>;
  },
) {
  const roles = row.targetRoles.filter(
    (role): role is AnnouncementTargetRules["roles"][number] =>
      ANNOUNCEMENT_ROLES.includes(
        role as AnnouncementTargetRules["roles"][number],
      ),
  );
  if (roles.length === 0) {
    if (row.audienceClassId) return `Class · ${row.className ?? "Unknown class"}`;
    if (row.audienceRole) return `All ${row.audienceRole}s`;
    return "Everyone";
  }
  const rules: AnnouncementTargetRules = {
    roles,
    subjectIds: row.targetSubjectIds,
    yearLevels: row.targetYearLevels,
    classIds: row.targetClassIds,
    tutorIds: row.targetTutorIds,
    includeLinkedParents: row.includeLinkedParents,
  };
  return targetSummary(rules, {
    subjects: rules.subjectIds.map((id) => labels.subjects.get(id) ?? "Removed subject"),
    years: rules.yearLevels,
    classes: rules.classIds.map((id) => labels.classes.get(id) ?? "Removed class"),
    tutors: rules.tutorIds.map((id) => labels.tutors.get(id) ?? "Removed tutor"),
  });
}

function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, "en-AU", { numeric: true, sensitivity: "base" });
}
