import "server-only";
import type { DmGroup } from "@/components/dm/inbox-compose";
import { listMyThreads } from "@/lib/dm-queries";
import { getTutorDmContacts } from "../../_data";

/** Thread list and "New message" contacts for the tutor messaging pane. */
export async function loadTutorMessagesInbox(userId: string) {
  const [threads, contacts] = await Promise.all([
    listMyThreads(userId),
    getTutorDmContacts(userId),
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

  return { threads, groups };
}
