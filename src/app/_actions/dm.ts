"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  dmMessages,
  dmReads,
  dmThreads,
  notifications,
  profiles,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { canDM, getUserRole } from "@/lib/dm-permissions";

const BODY_MAX = 4000;

const sendSchema = z.object({
  threadId: z.string().uuid(),
  body: z.string().trim().min(1).max(BODY_MAX),
  rolePrefix: z.enum(["parent", "student", "tutor", "admin"]),
});

const markReadSchema = z.object({
  threadId: z.string().uuid(),
  rolePrefix: z.enum(["parent", "student", "tutor", "admin"]),
});

export async function sendMessage(formData: FormData) {
  const parsed = sendSchema.parse({
    threadId: formData.get("threadId"),
    body: formData.get("body"),
    rolePrefix: formData.get("rolePrefix"),
  });

  const user = await requireRole(parsed.rolePrefix);

  const threadRow = await db
    .select({
      id: dmThreads.id,
      userAId: dmThreads.userAId,
      userBId: dmThreads.userBId,
    })
    .from(dmThreads)
    .where(eq(dmThreads.id, parsed.threadId))
    .limit(1);
  if (threadRow.length === 0) throw new Error("Thread not found");
  const t = threadRow[0];
  if (t.userAId !== user.id && t.userBId !== user.id) {
    throw new Error("Forbidden");
  }
  const otherId = t.userAId === user.id ? t.userBId : t.userAId;

  const otherRole = await getUserRole(otherId);
  if (!otherRole) throw new Error("Recipient not found");
  const allowed = await canDM(
    user.id,
    parsed.rolePrefix,
    otherId,
    otherRole,
  );
  if (!allowed) throw new Error("Forbidden");

  await db.transaction(async (tx) => {
    await tx.insert(dmMessages).values({
      threadId: t.id,
      senderId: user.id,
      body: parsed.body,
    });
    await tx
      .update(dmThreads)
      .set({ lastActivityAt: new Date() })
      .where(eq(dmThreads.id, t.id));
  });

  const recipientHref = `/${otherRole}/messages/${t.id}`;
  const existing = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, otherId),
        eq(notifications.href, recipientHref),
        isNull(notifications.readAt),
      ),
    )
    .limit(1);
  if (existing.length === 0) {
    const senderProfile = await db
      .select({
        firstName: profiles.firstName,
        lastName: profiles.lastName,
      })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);
    const senderName = senderProfile[0]
      ? `${senderProfile[0].firstName} ${senderProfile[0].lastName}`.trim()
      : "Someone";
    await db.insert(notifications).values({
      userId: otherId,
      channel: "in_app" as const,
      title: `New message from ${senderName}`,
      body: null,
      href: recipientHref,
    });
  }

  revalidatePath(`/${parsed.rolePrefix}/messages/${t.id}`);
  revalidatePath(`/${parsed.rolePrefix}/messages`);
}

export async function markThreadRead(formData: FormData) {
  const parsed = markReadSchema.parse({
    threadId: formData.get("threadId"),
    rolePrefix: formData.get("rolePrefix"),
  });
  const user = await requireRole(parsed.rolePrefix);

  const threadRow = await db
    .select({
      id: dmThreads.id,
      userAId: dmThreads.userAId,
      userBId: dmThreads.userBId,
    })
    .from(dmThreads)
    .where(eq(dmThreads.id, parsed.threadId))
    .limit(1);
  if (threadRow.length === 0) throw new Error("Thread not found");
  const t = threadRow[0];
  if (t.userAId !== user.id && t.userBId !== user.id) {
    throw new Error("Forbidden");
  }

  const existing = await db
    .select({ userId: dmReads.userId })
    .from(dmReads)
    .where(and(eq(dmReads.userId, user.id), eq(dmReads.threadId, t.id)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(dmReads).values({
      userId: user.id,
      threadId: t.id,
      lastReadAt: new Date(),
    });
  } else {
    await db
      .update(dmReads)
      .set({ lastReadAt: new Date() })
      .where(and(eq(dmReads.userId, user.id), eq(dmReads.threadId, t.id)));
  }

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, user.id),
        eq(notifications.href, `/${parsed.rolePrefix}/messages/${t.id}`),
        isNull(notifications.readAt),
      ),
    );
}
