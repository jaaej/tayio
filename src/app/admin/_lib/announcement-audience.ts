import { classDisplayName } from "@/lib/class-display";
import {
  ANNOUNCEMENT_ROLES,
  targetSummary,
  type AnnouncementTargetRules,
} from "@/lib/announcement-rules";
import { distinctSubjects } from "@/lib/subject-label";

/*
 * Who an announcement went to, in words: one rule for the Announcements page
 * and the dashboard's Recent activity, so a targeted announcement never reads
 * "Everyone" in one place and "Parents · Classes: ..." in the other.
 */

export type AudienceLabels = {
  subjects: Map<string, string>;
  classes: Map<string, string>;
  tutors: Map<string, string>;
};

/** Display names for the ids an announcement can target. */
export function audienceLabelMaps(input: {
  subjects: readonly { id: string; name: string; yearLevel: string | null }[];
  classes: readonly { id: string; name: string; subjectName: string }[];
  tutors: readonly { id: string; firstName: string; lastName: string }[];
}): AudienceLabels {
  return {
    subjects: new Map(distinctSubjects([...input.subjects]).map((s) => [s.id, s.label])),
    classes: new Map(input.classes.map((c) => [c.id, classDisplayName(c.subjectName, c.name)])),
    tutors: new Map(input.tutors.map((t) => [t.id, `${t.firstName} ${t.lastName}`.trim()])),
  };
}

export type AudienceRow = {
  audienceRole: string | null;
  audienceClassId: string | null;
  className: string | null;
  targetRoles: string[];
  targetSubjectIds: string[];
  targetYearLevels: string[];
  targetClassIds: string[];
  targetTutorIds: string[];
  includeLinkedParents: boolean;
};

export function describeAudience(row: AudienceRow, labels: AudienceLabels): string {
  const roles = row.targetRoles.filter(
    (role): role is AnnouncementTargetRules["roles"][number] =>
      ANNOUNCEMENT_ROLES.includes(role as AnnouncementTargetRules["roles"][number]),
  );
  // Announcements written before targeting rules (migration 0048).
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
