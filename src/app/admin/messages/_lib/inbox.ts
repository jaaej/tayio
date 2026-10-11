import "server-only";
import type { DmGroup } from "@/components/dm/inbox-compose";
import {
  listDmDirectoryForAdmin,
  listMyThreads,
  type DmDirectoryEntry,
} from "@/lib/dm-queries";

/** Thread list and "New message" contacts for the admin messaging pane. */
export async function loadAdminMessagesInbox(userId: string) {
  const [threads, directory] = await Promise.all([
    listMyThreads(userId),
    listDmDirectoryForAdmin(userId),
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

  return { threads, groups };
}
