import { redirect } from "next/navigation";

/**
 * Tutors no longer have a student list: each class's Students roster lists
 * its students, and the search box finds any student by name. Old links and
 * bookmarks land on Classes. Profiles stay at /tutor/students/[id].
 */
export default function TutorStudentsPage() {
  redirect("/tutor/classes");
}
