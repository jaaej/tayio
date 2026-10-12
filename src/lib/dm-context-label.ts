import type { CoarseRole } from "@/lib/roles";

/** A student who links the two people in a conversation, with the classes involved. */
export type LinkedStudent = {
  id: string;
  firstName: string;
  lastName: string;
  classNames: string[];
};

function uniq(values: string[]): string[] {
  return [...new Set(values)];
}

/** Class names already contain " · " ("Year 9 Maths · Saturday AM"), so classes are comma-separated. */
function withClasses(who: string, classNames: string[]): string {
  const list = uniq(classNames);
  return list.length === 0 ? who : `${who} · ${list.join(", ")}`;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Who the other person in a conversation is to the viewer, the same shape in
 * every role: "<who they are> · <classes that connect you>".
 *
 * `students` are the students linking the two: the student themself, a
 * parent's children, or (when the other person is a tutor) the viewer or the
 * viewer's children. `tutorClassNames` is used when an admin views a tutor.
 * Null for an admin viewing another admin, who sees the admin tier instead.
 */
export function conversationContextLabel({
  viewer,
  other,
  students,
  tutorClassNames = [],
}: {
  viewer: CoarseRole;
  other: CoarseRole;
  students: LinkedStudent[];
  tutorClassNames?: string[];
}): string | null {
  const classes = students.flatMap((s) => s.classNames);
  const fullNames = students.map((s) => `${s.firstName} ${s.lastName}`);
  switch (other) {
    case "student":
      return withClasses("Student", classes);
    case "parent":
      return withClasses(
        students.length > 0 ? `Parent of ${joinNames(fullNames)}` : "Parent",
        classes,
      );
    case "tutor": {
      if (viewer === "admin") return withClasses("Tutor", tutorClassNames);
      if (viewer === "parent" && students.length > 0) {
        const owner = joinNames(students.map((s) => s.firstName));
        return withClasses(`${owner}'s tutor`, classes);
      }
      return withClasses("Tutor", classes);
    }
    case "admin":
      // Owner vs reception is an internal distinction other admins need.
      return viewer === "admin" ? null : "Admin";
  }
}
