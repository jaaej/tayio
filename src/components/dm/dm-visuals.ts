import type { UserRole } from "@/db/schema";

/** First initial of a name, uppercased. */
export function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

/** Distinct, tasteful accent per role for DM avatars. */
export function roleColor(role: UserRole | string): string {
  switch (role) {
    case "tutor":
      return "#0EA5A4"; // teal
    case "parent":
      return "#E08A2B"; // amber
    case "admin":
      return "#7C6AE0"; // violet
    case "student":
    default:
      return "#4F5BD5"; // cornflower / brand
  }
}
