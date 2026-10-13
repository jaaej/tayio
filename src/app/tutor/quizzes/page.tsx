import { redirect } from "next/navigation";

/**
 * Tutors no longer have a quiz list: each quiz is opened from its week in a
 * class's week plan, or from the admin's request notification. Old links and
 * bookmarks land on Classes.
 */
export default function TutorQuizzesPage() {
  redirect("/tutor/classes");
}
