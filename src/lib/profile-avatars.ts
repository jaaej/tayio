export const PROFILE_AVATAR_KEYS = [
  "sparkles",
  "star",
  "rocket",
  "brain",
  "book",
  "calculator",
  "palette",
  "cat",
  "dog",
  "rabbit",
  "bird",
  "fish",
] as const;

export type ProfileAvatarKey = (typeof PROFILE_AVATAR_KEYS)[number];

export const PROFILE_AVATAR_OPTIONS: Array<{
  key: ProfileAvatarKey;
  label: string;
}> = [
  { key: "sparkles", label: "Sparkles" },
  { key: "star", label: "Star" },
  { key: "rocket", label: "Rocket" },
  { key: "brain", label: "Brain" },
  { key: "book", label: "Book" },
  { key: "calculator", label: "Calculator" },
  { key: "palette", label: "Palette" },
  { key: "cat", label: "Cat" },
  { key: "dog", label: "Dog" },
  { key: "rabbit", label: "Rabbit" },
  { key: "bird", label: "Bird" },
  { key: "fish", label: "Fish" },
];

export function isProfileAvatarKey(
  value: string | null | undefined,
): value is ProfileAvatarKey {
  return PROFILE_AVATAR_KEYS.includes(value as ProfileAvatarKey);
}
