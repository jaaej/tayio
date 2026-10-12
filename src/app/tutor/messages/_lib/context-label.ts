/** A student the tutor teaches, as seen from a conversation. */
export type TaughtStudent = {
  id: string;
  firstName: string;
  lastName: string;
  classNames: string[];
};

export type ConversationContext = {
  context: string;
  profileHref: string;
  profileLabel: string;
};

function uniq(values: string[]): string[] {
  return [...new Set(values)];
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Header context for a tutor's conversation: which of their classes the
 * person belongs to and where to open the student. A parent reads "Parent of
 * Sarah Student · Year 9 Maths" and links to the child; a student reads
 * "Student · Year 9 Maths". Null when the tutor teaches nobody in it.
 */
export function tutorConversationContext(
  other: { id: string; kind: "student" | "parent" },
  students: TaughtStudent[],
): ConversationContext | null {
  if (other.kind === "student") {
    const me = students.find((s) => s.id === other.id);
    if (!me) return null;
    return {
      context: ["Student", ...uniq(me.classNames)].join(" · "),
      profileHref: `/tutor/students/${me.id}`,
      profileLabel: "View profile",
    };
  }
  if (students.length === 0) return null;
  const first = students[0];
  return {
    context: [
      `Parent of ${joinNames(students.map((s) => `${s.firstName} ${s.lastName}`))}`,
      ...uniq(students.flatMap((s) => s.classNames)),
    ].join(" · "),
    profileHref: `/tutor/students/${first.id}`,
    profileLabel: `View ${first.firstName}`,
  };
}
