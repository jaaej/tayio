// Solid background colour per author role — used for avatar circles in
// discussion threads so the speaker is identifiable at a glance.
const ROLE_TONE = {
  student: "#4f5bd5",
  tutor: "#1fa974",
  parent: "#7b5bd6",
  admin: "#db7400",
} as const;

export function roleColor(role: string): string {
  return ROLE_TONE[role as keyof typeof ROLE_TONE] ?? ROLE_TONE.student;
}

export function initialOf(name: string): string {
  return (name.trim().charAt(0) || "?").toUpperCase();
}

export function relativeShort(d: Date): string {
  const ms = Date.now() - d.getTime();
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(ms / 86400000);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}
