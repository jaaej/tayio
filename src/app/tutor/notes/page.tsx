import { redirect } from "next/navigation";

// Lesson notes live on each student's profile (/tutor/students/[id], opened
// from a class's Students roster) and the latest ones are on Today, so this
// old list has no job of its own. Kept as a redirect for bookmarks.
export default function TutorNotesPage() {
  redirect("/tutor/classes");
}
