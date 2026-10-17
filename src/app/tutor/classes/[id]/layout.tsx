/**
 * The class page's frame. Each tab (Week plan, Lessons, Students,
 * Announcements) renders the class hero itself, through `ClassHero`, so Week
 * plan can title it with the open week; each tab also re-checks ownership.
 */
export default function TutorClassLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex flex-col gap-5">{children}</div>;
}
