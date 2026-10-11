import "server-only";
import type { DmGroup } from "@/components/dm/inbox-compose";
import { listMyThreads } from "@/lib/dm-queries";
import { getParentDmContacts } from "../../_data";

/** Thread list and "New message" contacts for the parent messaging pane. */
export async function loadParentMessagesInbox(userId: string) {
  const [threads, contacts] = await Promise.all([
    listMyThreads(userId),
    getParentDmContacts(userId),
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

  return { threads, groups };
}
