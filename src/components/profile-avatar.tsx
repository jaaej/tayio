import {
  Bird,
  BookOpen,
  Brain,
  Calculator,
  Cat,
  Dog,
  Fish,
  Palette,
  Rabbit,
  Rocket,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isProfileAvatarKey,
  type ProfileAvatarKey,
} from "@/lib/profile-avatars";

const ICONS: Record<ProfileAvatarKey, LucideIcon> = {
  sparkles: Sparkles,
  star: Star,
  rocket: Rocket,
  brain: Brain,
  book: BookOpen,
  calculator: Calculator,
  palette: Palette,
  cat: Cat,
  dog: Dog,
  rabbit: Rabbit,
  bird: Bird,
  fish: Fish,
};

const COLOURS: Record<ProfileAvatarKey, string> = {
  sparkles: "bg-violet-100 text-violet-700",
  star: "bg-amber-100 text-amber-700",
  rocket: "bg-blue-100 text-blue-700",
  brain: "bg-pink-100 text-pink-700",
  book: "bg-emerald-100 text-emerald-700",
  calculator: "bg-cyan-100 text-cyan-700",
  palette: "bg-fuchsia-100 text-fuchsia-700",
  cat: "bg-orange-100 text-orange-700",
  dog: "bg-lime-100 text-lime-700",
  rabbit: "bg-rose-100 text-rose-700",
  bird: "bg-sky-100 text-sky-700",
  fish: "bg-indigo-100 text-indigo-700",
};

export function ProfileAvatar({
  avatarKey,
  fallback,
  className,
  iconClassName,
}: {
  avatarKey: string | null | undefined;
  fallback: string;
  className?: string;
  iconClassName?: string;
}) {
  if (!isProfileAvatarKey(avatarKey)) {
    return (
      <span
        className={cn(
          "grid place-items-center rounded-full bg-brand-500 font-extrabold text-white",
          className,
        )}
        aria-label={`Profile icon: ${fallback}`}
      >
        {fallback}
      </span>
    );
  }

  const Icon = ICONS[avatarKey];
  return (
    <span
      className={cn(
        "grid place-items-center rounded-full",
        COLOURS[avatarKey],
        className,
      )}
      aria-label={`Profile icon: ${avatarKey}`}
    >
      <Icon className={cn("h-1/2 w-1/2", iconClassName)} aria-hidden />
    </span>
  );
}
