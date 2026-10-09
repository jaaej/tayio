"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { PROFILE_AVATAR_KEYS } from "@/lib/profile-avatars";
import {
  PROFILE_PHOTO_BUCKET,
  removeProfilePhoto,
} from "@/lib/profile-photo-storage";
import {
  createDirectUploadGrant,
  discardDirectUpload,
  finalizeDirectUpload,
} from "@/lib/direct-upload";
import {
  PROFILE_PHOTO_POLICY,
  validateUploadMetadata,
} from "@/lib/upload-validation";
import { withActor } from "@/lib/with-actor";

const avatarSchema = z.enum(PROFILE_AVATAR_KEYS);
const TUTOR_PROFILE_PHOTO_PURPOSE = "tutor-profile-photo";
const photoSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(200),
  sizeBytes: z.number().int().positive(),
});

function revalidateTutorProfile() {
  revalidatePath("/tutor", "layout");
  revalidatePath("/tutor/profile");
}

export async function setMyTutorProfileAvatar(avatarKey: string) {
  const user = await requireRole("tutor");
  const parsed = avatarSchema.safeParse(avatarKey);
  if (!parsed.success) {
    return { ok: false as const, error: "Choose one of the available icons." };
  }

  const [current] = await db
    .select({ avatarUrl: profiles.avatarUrl })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  await withActor({ id: user.id, role: "tutor" }, async (tx) => {
    await tx
      .update(profiles)
      .set({
        avatarUrl: null,
        profileAvatarKey: parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, user.id));
  });
  await removeProfilePhoto(current?.avatarUrl);
  revalidateTutorProfile();
  return { ok: true as const };
}

export async function prepareTutorProfilePhotoUpload(input: {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}) {
  const user = await requireRole("tutor");
  const parsed = photoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.message };
  }

  const validated = validateUploadMetadata(
    { size: parsed.data.sizeBytes, type: parsed.data.contentType },
    PROFILE_PHOTO_POLICY,
  );
  if (!validated.ok) return validated;

  return createDirectUploadGrant({
    purpose: TUTOR_PROFILE_PHOTO_PURPOSE,
    userId: user.id,
    scope: user.id,
    bucket: PROFILE_PHOTO_BUCKET,
    path: `${user.id}/${Date.now()}-${randomUUID()}.${validated.file.ext}`,
    fileName: parsed.data.fileName,
    sizeBytes: parsed.data.sizeBytes,
    contentType: parsed.data.contentType,
    policy: PROFILE_PHOTO_POLICY,
  });
}

export async function saveMyTutorProfilePhoto(uploadTicket: string) {
  const user = await requireRole("tutor");
  const verified = await finalizeDirectUpload({
    ticket: uploadTicket,
    expectedPurpose: TUTOR_PROFILE_PHOTO_PURPOSE,
    expectedUserId: user.id,
    expectedScope: user.id,
    policy: PROFILE_PHOTO_POLICY,
  });
  if (!verified.ok) return verified;

  const [current] = await db
    .select({ avatarUrl: profiles.avatarUrl })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  try {
    await withActor({ id: user.id, role: "tutor" }, async (tx) => {
      await tx
        .update(profiles)
        .set({
          avatarUrl: verified.value.path,
          profileAvatarKey: null,
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, user.id));
    });
  } catch (error) {
    await discardDirectUpload(uploadTicket);
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Profile photo could not be saved",
    };
  }

  await removeProfilePhoto(current?.avatarUrl);
  revalidateTutorProfile();
  return { ok: true as const };
}

export async function removeMyTutorProfilePhoto() {
  const user = await requireRole("tutor");
  const [current] = await db
    .select({ avatarUrl: profiles.avatarUrl })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  await withActor({ id: user.id, role: "tutor" }, async (tx) => {
    await tx
      .update(profiles)
      .set({ avatarUrl: null, updatedAt: new Date() })
      .where(eq(profiles.id, user.id));
  });
  await removeProfilePhoto(current?.avatarUrl);
  revalidateTutorProfile();
  return { ok: true as const };
}
