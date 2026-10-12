import { Avatar } from "@/components/admin/ui";
import { ProfileAvatar } from "@/components/profile-avatar";
import { isProfileAvatarKey } from "@/lib/profile-avatars";

const SIZE = {
  34: "h-[34px] w-[34px]",
  52: "h-[52px] w-[52px]",
} as const;

/**
 * A student's chosen profile icon, or their initials on the glass kit's
 * lilac avatar when they have not picked one. Decorative: the name always
 * sits next to it.
 */
export function StudentAvatar({
  name,
  avatarKey,
  size,
}: {
  name: string;
  avatarKey: string | null;
  size: keyof typeof SIZE;
}) {
  if (!isProfileAvatarKey(avatarKey)) {
    return <Avatar name={name} size={size} tone="brand" />;
  }
  return (
    <span aria-hidden className="shrink-0">
      <ProfileAvatar avatarKey={avatarKey} fallback="" className={SIZE[size]} />
    </span>
  );
}
