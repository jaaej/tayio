import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { Card, CardBody, CardHead } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { ProfileIconPicker } from "@/components/profile-icon-picker";
import { setMyTutorProfileAvatar } from "./actions";

export const dynamic = "force-dynamic";

export default async function TutorProfilePage() {
  const user = await requireRole("tutor");
  const [profile] = await db
    .select({
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      profileAvatarKey: profiles.profileAvatarKey,
    })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  const initials = profile
    ? `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase()
    : "T";

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Your profile"
        title="Choose your icon"
        sub="Choose the profile icon shown in your tutor portal."
      />
      <Card>
        <CardHead title="Profile icon" />
        <CardBody>
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
