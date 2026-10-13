import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { Avatar, GlassPanel } from "@/components/admin/ui";
import { ProfileAvatar } from "@/components/profile-avatar";
import { ProfileIconPicker } from "@/components/profile-icon-picker";
import { isProfileAvatarKey } from "@/lib/profile-avatars";
import { getStudentTutors } from "../_lib/queries";
import { PasswordChangeForm } from "./_components/password-change-form";
import { setMyProfileAvatar } from "./actions";

export const dynamic = "force-dynamic";

/** "9" and "Year 9" both read as "Year 9". */
function yearLabel(yearLevel: string | null | undefined): string | null {
  const v = yearLevel?.trim();
  if (!v) return null;
  return /^\d+$/.test(v) ? `Year ${v}` : v;
}

export default async function StudentProfileIconPage() {
  const user = await requireRole("student");
  const [[profile], tutors] = await Promise.all([
    db
      .select({
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        email: profiles.email,
        yearLevel: profiles.yearLevel,
        profileAvatarKey: profiles.profileAvatarKey,
      })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1),
    getStudentTutors(user.id),
  ]);

  const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() : "Student";
  const initials = profile
    ? `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase()
    : "S";
  const subjects = Array.from(new Set(tutors.flatMap((t) => t.subjects))).sort((a, b) =>
    a.localeCompare(b),
  );
  const meta = [yearLabel(profile?.yearLevel), profile?.email, subjects.join(", ") || null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex max-w-[980px] flex-col gap-5">
      <header className="glass flex flex-wrap items-center gap-4 rounded-[24px] py-3.5 pl-[22px] pr-[18px]">
        {isProfileAvatarKey(profile?.profileAvatarKey) ? (
          <span aria-hidden>
            <ProfileAvatar
              avatarKey={profile?.profileAvatarKey}
              fallback={initials}
              className="h-14 w-14 shrink-0"
            />
          </span>
        ) : (
          <Avatar name={name} size={56} tone="ink" />
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-[22px] font-extrabold leading-tight text-ink">{name}</h1>
          {meta && (
            <p className="text-[13px] font-medium text-ink-soft [overflow-wrap:anywhere]">
              {meta}
            </p>
          )}
        </div>
      </header>

      <GlassPanel
        title="Profile icon"
        titleId="profile-icon-heading"
        bodyClassName="p-4"
      >
        <ProfileIconPicker
          current={profile?.profileAvatarKey ?? null}
          initials={initials}
          updateAction={setMyProfileAvatar}
        />
      </GlassPanel>

      <GlassPanel
        title="Password & security"
        titleId="password-heading"
        bodyClassName="p-[18px]"
      >
        <PasswordChangeForm />
      </GlassPanel>
    </div>
  );
}
