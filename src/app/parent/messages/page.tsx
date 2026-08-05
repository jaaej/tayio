import { PageHeader } from "@/components/parent/ui";
import { InboxCompose, type DmGroup } from "@/components/dm/inbox-compose";
import { requireRole } from "@/lib/auth";
import { listMyThreads } from "@/lib/dm-queries";
import { getParentDmContacts } from "../_data";

export default async function ParentMessagesPage() {
  const user = await requireRole("parent");
  const [threads, contacts] = await Promise.all([
    listMyThreads(user.id),
    getParentDmContacts(user.id),
  ]);

  const groups: DmGroup[] = [];
  if (contacts.tutors.length > 0) {
    groups.push({ label: "Tutors", contacts: contacts.tutors });
  }
  if (contacts.admin) {
    groups.push({
      label: "Admin office",
      contacts: [
        {
          id: contacts.admin.id,
          name: contacts.admin.name,
          meta: "Billing, enrolment & general questions",
          office: true,
        },
      ],
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
      />
      <InboxCompose
        threads={threads}
        hrefPrefix="/parent/messages"
        groups={groups}
      />
    </div>
  );
}
