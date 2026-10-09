import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { Card, CardBody, CardHead } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { ProfileIconPicker } from "@/components/profile-icon-picker";
import { ProfilePhotoUploader } from "@/components/tutor/profile-photo-uploader";
import { signProfilePhoto } from "@/lib/profile-photo-storage";
import { setMyTutorProfileAvatar } from "./actions";

export const dynamic = "force-dynamic";

export default async function TutorProfilePage() {
  const user = await requireRole("tutor");
  const [profile] = await db
    .select({
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      avatarUrl: profiles.avatarUrl,
      profileAvatarKey: profiles.profileAvatarKey,
    })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  const initials = profile
    ? `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase()
    : "T";
  const photoUrl = await signProfilePhoto(profile?.avatarUrl);

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Your profile"
        title="Profile photo and icon"
      />
      <Card>
        <CardHead title="Profile photo" />
        <CardBody>
          <ProfilePhotoUploader photoUrl={photoUrl} initials={initials} />
        </CardBody>
      </Card>
      <Card>
        <CardHead title="Profile icon" />
        <CardBody>
          {photoUrl && (
            <p className="mb-4 text-[12px] text-muted">
              Choosing an icon removes the current profile photo.
            </p>
          )}
          <ProfileIconPicker
            current={profile?.profileAvatarKey ?? null}
            initials={initials}
            updateAction={setMyTutorProfileAvatar}
          />
        </CardBody>
      </Card>
    </div>
  );
}
