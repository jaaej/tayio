import { desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { AlertTriangle, Megaphone } from "lucide-react";
import { db } from "@/db/client";
import {
  announcementRecipients,
  announcements,
  classes,
  profiles,
  subjects,
} from "@/db/schema";
import {
  Card,
  CardBody,
  CardHead,
  Empty,
  PageHeader,
  Pill,
} from "@/components/admin/ui";
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
    <div className="space-y-6">
      <PageHeader
        className="rise"
        eyebrow="Communications"
        title="Announcements"
      />

      {pendingRows.length > 0 ? (
        <section className="rise space-y-3" style={{ animationDelay: "40ms" }}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warn" aria-hidden />
            <h2 className="text-[15px] font-extrabold text-ink">
              Tutor announcements awaiting approval ({pendingRows.length})
            </h2>
          </div>
          {pendingRows.map((row) => (
            <AnnouncementCard
              key={row.id}
              row={row}
              audience={describeAudience(row, labelMaps)}
              review
            />
          ))}
        </section>
      ) : null}

      <section className="rise" style={{ animationDelay: "80ms" }}>
        <Card accent="brand">
          <CardHead title="Send announcement" eyebrow="Compose" />
          <CardBody>
            <CreateAnnouncementForm options={options} />
          </CardBody>
        </Card>
      </section>

      <section className="rise space-y-4" style={{ animationDelay: "120ms" }}>
        <h2 className="text-[15px] font-extrabold text-ink">Announcement history</h2>
        {historyRows.length === 0 ? (
          <Card>
            <Empty>No announcements yet. Write your first above.</Empty>
          </Card>
        ) : (
          historyRows.map((row) => (
            <AnnouncementCard
              key={row.id}
              row={row}
              audience={describeAudience(row, labelMaps)}
            />
          ))
        )}
      </section>
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

function AnnouncementCard({
  row,
  audience,
  review = false,
}: {
  row: AnnouncementRow;
  audience: string;
  review?: boolean;
}) {
  return (
    <Card key={row.id} accent={review ? "warn" : undefined}>
      <div id={`announcement-${row.id}`} className="p-5 scroll-mt-20">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={row.status === "rejected" ? "bad" : review ? "warn" : "brand"} dot>
                {row.status === "pending"
                  ? "Pending approval"
                  : row.status === "rejected"
                    ? "Rejected"
                    : "Published"}
              </Pill>
              {row.isUrgent ? <Pill tone="bad">Urgent + email</Pill> : null}
              {row.status === "published" ? (
                <Pill tone="default">{row.recipientCount} recipients</Pill>
              ) : null}
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-2">
                {new Date(row.publishedAt).toLocaleString("en-AU", {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="mt-2 text-[12px] font-semibold text-brand-700">{audience}</p>
            <h3 className="mt-2 text-[16px] font-extrabold tracking-[-0.01em] text-ink">
              {row.title}
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-[13px] text-ink-soft">
              {row.body}
            </p>
            {row.rejectedReason ? (
              <p className="mt-3 rounded-[10px] bg-bad-bg px-3 py-2 text-[12px] text-bad">
                Rejection reason: {row.rejectedReason}
              </p>
            ) : null}
            <div className="mt-3 flex items-center gap-1.5 text-[12px] text-muted">
              <Megaphone className="h-3.5 w-3.5" aria-hidden />
              by {row.authorFirst} {row.authorLast}
            </div>
          </div>
          {!review ? <DeleteAnnouncementButton id={row.id} title={row.title} /> : null}
        </div>
        {review ? (
          <div className="mt-4 border-t border-line pt-4">
            <AnnouncementReviewActions id={row.id} />
          </div>
        ) : null}
      </div>
    </Card>
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
