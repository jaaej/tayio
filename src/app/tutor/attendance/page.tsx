import { redirect } from "next/navigation";

// Attendance now lives on each class's Lessons tab.
export default function TutorAttendancePage() {
  redirect("/tutor/classes");
}
