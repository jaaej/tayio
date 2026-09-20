"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { PROFILE_AVATAR_KEYS } from "@/lib/profile-avatars";
import { withActor } from "@/lib/with-actor";

const avatarSchema = z.enum(PROFILE_AVATAR_KEYS);

export async function setMyProfileAvatar(avatarKey: string) {
  const user = await requireRole("student");
  const parsed = avatarSchema.safeParse(avatarKey);
  if (!parsed.success) {
    return { ok: false as const, error: "Choose one of the available icons." };
  }

  await withActor({ id: user.id, role: "student" }, async (tx) => {
    await tx
      .update(profiles)
      .set({ profileAvatarKey: parsed.data, updatedAt: new Date() })
      .where(eq(profiles.id, user.id));
  });
  revalidatePath("/student", "layout");
  revalidatePath("/student/profile");
  revalidatePath("/tutor/students", "page");
  revalidatePath("/tutor/students/[id]", "page");
  return { ok: true as const };
}
