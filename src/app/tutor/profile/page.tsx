import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles, tutorBankDetails } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { Avatar, GlassPanel } from "@/components/admin/ui";
import { ProfileAvatar } from "@/components/profile-avatar";
import { ProfileIconPicker } from "@/components/profile-icon-picker";
import { ProfilePhotoUploader } from "@/components/tutor/profile-photo-uploader";
import { isProfileAvatarKey } from "@/lib/profile-avatars";
import { signProfilePhoto } from "@/lib/profile-photo-storage";
import { getTutorStudentsByClass } from "../_data";
import { setMyTutorProfileAvatar } from "./actions";

export const dynamic = "force-dynamic";

const rateFmt = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export default async function TutorProfilePage() {
  const user = await requireRole("tutor");
  const [[profile], [bank], roster] = await Promise.all([
    db
      .select({
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        email: profiles.email,
        avatarUrl: profiles.avatarUrl,
        profileAvatarKey: profiles.profileAvatarKey,
      })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1),
    // Only the tutor's own rate: the rest of the payroll row (bank details)
    // stays out of the tutor portal.
    db
      .select({ hourlyRate: tutorBankDetails.hourlyRate })
      .from(tutorBankDetails)
      .where(eq(tutorBankDetails.tutorId, user.id))
      .limit(1),
    getTutorStudentsByClass(user.id),
  ]);

  const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() : "Tutor";
  const initials = profile
    ? `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase()
    : "T";
  const photoUrl = await signProfilePhoto(profile?.avatarUrl);

  const subjects = Array.from(new Set(roster.classes.map((c) => c.subjectName))).sort((a, b) =>
    a.localeCompare(b),
  );
  const rate = bank?.hourlyRate != null && Number(bank.hourlyRate) > 0 ? Number(bank.hourlyRate) : null;
  // Only values that exist: a rate the office has not set yet is left out
  // rather than shown as a placeholder.
  const details = [
    rate !== null ? { k: "Hourly rate", v: `${rateFmt.format(rate)} / hr` } : null,
    { k: "Classes", v: String(roster.classes.length) },
    { k: "Students", v: String(roster.totalStudents) },
  ].filter((d): d is { k: string; v: string } => d !== null);

  return (
    <div className="flex max-w-[980px] flex-col gap-5">
      <header className="glass flex flex-wrap items-center gap-4 rounded-[24px] py-3.5 pl-[22px] pr-[18px]">
        {photoUrl ? (
          <ProfileAvatar
            avatarKey={null}
            imageUrl={photoUrl}
            fallback={initials}
            className="h-14 w-14 shrink-0"
          />
        ) : isProfileAvatarKey(profile?.profileAvatarKey) ? (
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
          <p className="text-[13px] font-medium text-ink-soft [overflow-wrap:anywhere]">
            {["Tutor", profile?.email, subjects.join(", ") || null].filter(Boolean).join(" · ")}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-start gap-5">
        <GlassPanel
          title="Profile photo"
          titleId="profile-photo-heading"
          className="min-w-0 flex-[1_1_300px]"
          bodyClassName="p-[18px]"
        >
          <ProfilePhotoUploader photoUrl={photoUrl} initials={initials} />
        </GlassPanel>

        <GlassPanel
          title="Profile icon"
          titleId="profile-icon-heading"
          meta={photoUrl ? "Choosing an icon removes your photo" : "Shown when you have no photo"}
          className="min-w-0 flex-[999_1_420px]"
          bodyClassName="p-4"
        >
          <ProfileIconPicker
            current={profile?.profileAvatarKey ?? null}
            initials={initials}
            updateAction={setMyTutorProfileAvatar}
          />
        </GlassPanel>
      </div>

      <GlassPanel
        title="Teaching details"
        titleId="teaching-details-heading"
        meta="Set by admin. Message the office to change them."
        bodyClassName="p-1.5"
      >
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-0.5">
          {details.map((d) => (
            <div key={d.k} className="flex flex-col gap-0.5 p-3">
              <dt className="text-[12px] font-bold text-muted">{d.k}</dt>
              <dd className="text-[15px] font-extrabold tabular-nums text-ink">{d.v}</dd>
            </div>
          ))}
        </dl>
      </GlassPanel>
    </div>
  );
}
