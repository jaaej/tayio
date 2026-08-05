import { PageHead } from "@/components/student/page-head";
import { InboxCompose, type DmGroup } from "@/components/dm/inbox-compose";
import { requireRole } from "@/lib/auth";
import { listMyThreads } from "@/lib/dm-queries";
import { getTutorDmContacts } from "../_data";

export default async function TutorMessagesPage() {
  const user = await requireRole("tutor");
  const [threads, contacts] = await Promise.all([
    listMyThreads(user.id),
    getTutorDmContacts(user.id),
  ]);

  const groups: DmGroup[] = [];
  if (contacts.students.length > 0) {
    groups.push({ label: "Students", contacts: contacts.students });
  }
  if (contacts.parents.length > 0) {
    groups.push({ label: "Parents", contacts: contacts.parents });
  }
  if (contacts.admin) {
    groups.push({
      label: "Admin office",
      contacts: [{ id: contacts.admin.id, name: contacts.admin.name, office: true }],
    });
  }

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Messages"
        title="Direct messages"
      />
      <InboxCompose
        threads={threads}
        hrefPrefix="/tutor/messages"
        groups={groups}
      />
    </div>
  );
}
