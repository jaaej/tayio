import { formatScore } from "@/lib/format";
import { forParent, withChild } from "@/lib/parent-child";

export type HomeworkResult = "marked" | "resubmission_requested";

/**
 * What a student and their linked parents are told when a tutor marks a
 * homework or asks for it to be done again. The homework's title goes in the
 * body, never the title, so a title like "Request letter" can't change which
 * inbox group the notice lands in. Parents' copies lead with the child.
 */
export function homeworkResultNotifications(input: {
  homeworkId: string;
  homeworkTitle: string;
  studentId: string;
  studentFirstName: string;
  parentIds: readonly string[];
  result: HomeworkResult;
  score: string | null;
  /** Written feedback or marks on the file, so the notice can point to it. */
  hasFeedback: boolean;
  /** Makes each marking its own notice, so a later re-mark is not swallowed. */
  markedAt: Date;
}) {
  const marked = input.result === "marked";
  // The family's word for a mark (the homework page says "Feedback given" too).
  const title = marked ? "Feedback given" : "Resubmission requested";
  const body = marked
    ? input.score === null
      ? input.homeworkTitle
      : `${input.homeworkTitle} · ${formatScore(input.score)}`
    : `${input.homeworkTitle} needs to be done again.${input.hasFeedback ? " See your tutor's feedback." : ""}`;
  const parentBody = marked
    ? body
    : `${input.homeworkTitle} needs to be done again.${input.hasFeedback ? " See the tutor's feedback." : ""}`;
  const dedupe = `homework-result:${input.homeworkId}:${input.studentId}:${input.result}:${input.markedAt.getTime()}`;
  const href = `/homework/${input.homeworkId}`;
  return [
    {
      userId: input.studentId,
      channel: "in_app" as const,
      title,
      body,
      href: `/student${href}`,
      dedupeKey: dedupe,
    },
    ...input.parentIds.map((userId) => ({
      userId,
      channel: "in_app" as const,
      title,
      body: forParent([input.studentFirstName], parentBody),
      href: withChild(`/parent${href}`, input.studentId),
      dedupeKey: dedupe,
    })),
  ];
}
