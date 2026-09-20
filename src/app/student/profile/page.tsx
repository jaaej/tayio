import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { Card, CardBody, CardHead } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { ProfileIconPicker } from "./_components/profile-icon-picker";

export const dynamic = "force-dynamic";

export default async function StudentProfileIconPage() {
  const user = await requireRole("student");
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
    : "S";

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Your profile"
        title="Choose your icon"
        sub="Pick an icon that represents you. Your assigned tutors will see it beside your name."
      />
      <Card>
        <CardHead title="Icon library" />
        <CardBody>
          <ProfileIconPicker
            current={profile?.profileAvatarKey ?? null}
            initials={initials}
          />
        </CardBody>
      </Card>
    </div>
  );
}
