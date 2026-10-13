import { notFound } from "next/navigation";
import type { UserRole } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import {
  canSeeBoard,
  getThreadWithReplies,
} from "@/lib/discussions-queries";
import { resolveBoardId, threadIsOnBoard } from "@/lib/discussions";
import { DiscussionThreadDetail } from "@/components/discussions/thread-detail";
import {
  getAdminContactForStudent,
  getStudentTutors,
} from "../../../_lib/queries";
import { StuckPanel, type StuckLink } from "./_components/stuck-panel";

export default async function StudentThreadPage({
  params,
}: {
  params: Promise<{ boardId: string; threadId: string }>;
}) {
  const { boardId, threadId } = await params;
  const user = await requireRole("student");
  const board = resolveBoardId(boardId);
  if (!board) notFound();
  if (!(await canSeeBoard(user.id, "student", board))) notFound();

  const thread = await getThreadWithReplies(threadId);
  if (!thread || !threadIsOnBoard(thread.subjectId, board)) notFound();

  // Where to go next: the subject's week page and the student's tutor for it
  // on a subject board; the office on General help, which only billing-access
  // students may message (see canDM).
  const links: StuckLink[] = [];
  if (thread.subjectId && thread.subjectName) {
    const tutors = await getStudentTutors(user.id);
    links.push({
      href: `/student/subjects/${thread.subjectId}`,
      label: `Open ${thread.subjectName}`,
    });
    for (const t of tutors.filter((t) => t.subjects.includes(thread.subjectName!))) {
      links.push({
        href: `/student/messages/with/${t.id}`,
        label: `Message ${t.firstName} privately`,
      });
    }
  } else if (
    (user.app_metadata?.role as UserRole | undefined) === "student_unrestricted"
  ) {
    const office = await getAdminContactForStudent();
    if (office) {
      links.push({ href: `/student/messages/with/${office.id}`, label: "Message the office" });
    }
  }

  return (
    <DiscussionThreadDetail
      thread={thread}
      boardId={boardId}
      rolePrefix="student"
      aside={links.length > 0 ? <StuckPanel links={links} /> : undefined}
    />
  );
}
