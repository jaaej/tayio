"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "crypto";
import { db } from "@/db/client";
import {
  discussionAttachments,
  discussionReplies,
  discussionThreads,
  notifications,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { canSeeBoard } from "@/lib/discussions-queries";
import { uploadDiscussionAttachment } from "@/lib/discussions-storage";
import {
  resolveBoardId,
  boardSegment,
  type BoardId,
} from "@/lib/discussions";

const MAX_ATTACHMENTS = 3;

/**
 * Validate + upload any files in the `files` field to a fresh group folder.
 * Runs BEFORE the thread/reply insert so a failed/oversized upload aborts the
 * whole action cleanly (no orphan post). Returns metadata to insert as rows.
 */
async function stageAttachments(
  formData: FormData,
): Promise<
  Array<{
    fileName: string;
    storagePath: string;
    contentType: string;
    sizeBytes: number;
  }>
> {
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return [];
  if (files.length > MAX_ATTACHMENTS) {
    throw new Error(`You can attach at most ${MAX_ATTACHMENTS} files.`);
  }
  const groupId = randomUUID();
  const staged = [];
  for (const file of files) {
    const up = await uploadDiscussionAttachment(groupId, file);
    if (!up.ok) throw new Error(up.error);
    staged.push({
      fileName: file.name,
      storagePath: up.value.path,
      contentType: up.value.contentType,
      sizeBytes: file.size,
    });
  }
  return staged;
}

const TITLE_MAX = 140;
const BODY_MAX = 4000;

const createThreadSchema = z.object({
  boardSegment: z.string().min(1),
  title: z.string().trim().min(1).max(TITLE_MAX),
  body: z.string().trim().min(1).max(BODY_MAX),
  rolePrefix: z.enum(["student", "tutor", "admin"]),
});

const postReplySchema = z.object({
  threadId: z.string().uuid(),
  parentReplyId: z.string().uuid().optional(),
  body: z.string().trim().min(1).max(BODY_MAX),
  rolePrefix: z.enum(["student", "tutor", "admin"]),
});

const softDeleteSchema = z.object({
  kind: z.enum(["thread", "reply"]),
  id: z.string().uuid(),
});

export async function createThread(formData: FormData) {
  const parsed = createThreadSchema.parse({
    boardSegment: formData.get("boardSegment"),
    title: formData.get("title"),
    body: formData.get("body"),
    rolePrefix: formData.get("rolePrefix"),
  });

  const user = await requireRole(parsed.rolePrefix);

  if (
    !(await rateLimit({
      bucket: "discussion_thread",
      identifier: user.id,
      max: 10,
      windowSeconds: 60,
    }))
  ) {
    throw new Error("You're posting too quickly. Please slow down.");
  }

  const board = resolveBoardId(parsed.boardSegment);
  if (!board) throw new Error("Invalid board");

  const allowed = await canSeeBoard(user.id, parsed.rolePrefix, board);
  if (!allowed) throw new Error("Forbidden");

  // Upload first so a bad file aborts before we create the thread.
  const attachments = await stageAttachments(formData);

  const inserted = await db
    .insert(discussionThreads)
    .values({
      subjectId: board.kind === "admin" ? null : board.subjectId,
      authorId: user.id,
      title: parsed.title,
      body: parsed.body,
    })
    .returning({ id: discussionThreads.id });

  const newId = inserted[0].id;

  if (attachments.length > 0) {
    await db.insert(discussionAttachments).values(
      attachments.map((a) => ({
        threadId: newId,
        authorId: user.id,
        ...a,
      })),
    );
  }

  const seg = boardSegment(board);

  revalidatePath(`/${parsed.rolePrefix}/discussions`);
  revalidatePath(`/${parsed.rolePrefix}/discussions/${seg}`);
  redirect(`/${parsed.rolePrefix}/discussions/${seg}/${newId}`);
}

export async function postReply(formData: FormData) {
  const rawParent = formData.get("parentReplyId");
  const parsed = postReplySchema.parse({
    threadId: formData.get("threadId"),
    parentReplyId:
      typeof rawParent === "string" && rawParent.length > 0
        ? rawParent
        : undefined,
    body: formData.get("body"),
    rolePrefix: formData.get("rolePrefix"),
  });

  const user = await requireRole(parsed.rolePrefix);

  if (
    !(await rateLimit({
      bucket: "discussion_reply",
      identifier: user.id,
      max: 30,
      windowSeconds: 60,
    }))
  ) {
    throw new Error("You're posting too quickly. Please slow down.");
  }

  const threadRow = await db
    .select({
      id: discussionThreads.id,
      subjectId: discussionThreads.subjectId,
      authorId: discussionThreads.authorId,
      title: discussionThreads.title,
    })
    .from(discussionThreads)
    .where(eq(discussionThreads.id, parsed.threadId))
    .limit(1);

  if (threadRow.length === 0) throw new Error("Thread not found");
  const thread = threadRow[0];

  const board: BoardId =
    thread.subjectId === null
      ? { kind: "admin" }
      : { kind: "subject", subjectId: thread.subjectId };
  const allowed = await canSeeBoard(user.id, parsed.rolePrefix, board);
  if (!allowed) throw new Error("Forbidden");

  // Upload first so a bad file aborts before we create the reply.
  const attachments = await stageAttachments(formData);

  // Enforce 1-level nesting: if parentReplyId is provided, the parent must
  // itself be a top-level reply (no grandchildren).
  let parentReplyId: string | null = null;
  if (parsed.parentReplyId) {
    const parent = await db
      .select({ id: discussionReplies.id, parentReplyId: discussionReplies.parentReplyId })
      .from(discussionReplies)
      .where(eq(discussionReplies.id, parsed.parentReplyId))
      .limit(1);
    if (parent.length === 0) throw new Error("Parent reply not found");
    if (parent[0].parentReplyId !== null) {
      // Collapse depth: a reply to a child becomes a sibling of that child.
      parentReplyId = parent[0].parentReplyId;
    } else {
      parentReplyId = parent[0].id;
    }
  }

  await db.transaction(async (tx) => {
    const insertedReply = await tx
      .insert(discussionReplies)
      .values({
        threadId: thread.id,
        parentReplyId,
        authorId: user.id,
        body: parsed.body,
      })
      .returning({ id: discussionReplies.id });
    if (attachments.length > 0) {
      await tx.insert(discussionAttachments).values(
        attachments.map((a) => ({
          replyId: insertedReply[0].id,
          authorId: user.id,
          ...a,
        })),
      );
    }
    await tx
      .update(discussionThreads)
      .set({ lastActivityAt: new Date() })
      .where(eq(discussionThreads.id, thread.id));
  });

  if (thread.authorId !== user.id) {
    const href = `/${parsed.rolePrefix}/discussions/${boardSegment(board)}/${thread.id}`;
    const existing = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, thread.authorId),
          eq(notifications.href, href),
          isNull(notifications.readAt),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(notifications).values({
        userId: thread.authorId,
        channel: "in_app" as const,
        title: `New reply on "${thread.title}"`,
        body: null,
        href,
      });
    }
  }

  revalidatePath(
    `/${parsed.rolePrefix}/discussions/${boardSegment(board)}/${thread.id}`,
  );
  revalidatePath(`/${parsed.rolePrefix}/discussions/${boardSegment(board)}`);
}

export async function softDelete(formData: FormData) {
  const parsed = softDeleteSchema.parse({
    kind: formData.get("kind"),
    id: formData.get("id"),
  });

  await requireRole("admin");

  if (parsed.kind === "thread") {
    await db
      .update(discussionThreads)
      .set({ deletedAt: new Date() })
      .where(eq(discussionThreads.id, parsed.id));
  } else {
    await db
      .update(discussionReplies)
      .set({ deletedAt: new Date() })
      .where(eq(discussionReplies.id, parsed.id));
  }

  revalidatePath("/admin/discussions");
}
