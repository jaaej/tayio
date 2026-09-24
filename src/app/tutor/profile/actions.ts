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

export async function setMyTutorProfileAvatar(avatarKey: string) {
  const user = await requireRole("tutor");
  const parsed = avatarSchema.safeParse(avatarKey);
  if (!parsed.success) {
    return { ok: false as const, error: "Choose one of the available icons." };
  }

  await withActor({ id: user.id, role: "tutor" }, async (tx) => {
    await tx
      .update(profiles)
      .set({ profileAvatarKey: parsed.data, updatedAt: new Date() })
      .where(eq(profiles.id, user.id));
  });
  revalidatePath("/tutor", "layout");
  revalidatePath("/tutor/profile");
  return { ok: true as const };
}
