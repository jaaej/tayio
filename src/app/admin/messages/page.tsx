import { PageHeader } from "@/components/admin/ui";
import { InboxCompose, type DmGroup } from "@/components/dm/inbox-compose";
import { requireRole } from "@/lib/auth";
import {
  listDmDirectoryForAdmin,
  listMyThreads,
  type DmDirectoryEntry,
} from "@/lib/dm-queries";

export default async function AdminMessagesPage() {
  const user = await requireRole("admin");
  const [threads, directory] = await Promise.all([
    listMyThreads(user.id),
    listDmDirectoryForAdmin(user.id),
  ]);

  const toContacts = (entries: DmDirectoryEntry[]) =>
    entries.map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`.trim(),
    }));

  const groups: DmGroup[] = [
    { label: "Parents", contacts: toContacts(directory.parents) },
    { label: "Tutors", contacts: toContacts(directory.tutors) },
    { label: "Students", contacts: toContacts(directory.students) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        className="rise"
        eyebrow="Direct messages"
        title="Messages"
      />
      <InboxCompose
        threads={threads}
        hrefPrefix="/admin/messages"
        groups={groups}
      />
    </div>
  );
}
