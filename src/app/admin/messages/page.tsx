import Link from "next/link";
import { Card, CardLabel } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import {
  listDmDirectoryForAdmin,
  listMyThreads,
  type DmDirectoryEntry,
} from "@/lib/dm-queries";
import { ThreadRow } from "@/components/dm/thread-row";

export default async function AdminMessagesPage() {
  const user = await requireRole("admin");
  const [threads, directory] = await Promise.all([
    listMyThreads(user.id),
    listDmDirectoryForAdmin(user.id),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
          Messages
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Your direct conversations with parents, students, and tutors. Start a
          new conversation from the directory below.
        </p>
      </header>

      <section className="space-y-2">
        <div className="text-[11px] uppercase tracking-[0.2em] text-ink-soft font-medium px-1">
          Conversations
        </div>
        {threads.length === 0 ? (
          <Card>
            <div className="py-6 text-sm text-ink-soft">
              No conversations yet. Pick someone from the directory below to
              start one.
            </div>
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <ul className="divide-y divide-hairline/60">
              {threads.map((t) => (
                <li key={t.threadId}>
                  <ThreadRow thread={t} hrefPrefix="/admin/messages" />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section className="space-y-4">
        <div className="text-[11px] uppercase tracking-[0.2em] text-ink-soft font-medium px-1">
          Directory
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          <DirectoryColumn label="Parents" entries={directory.parents} />
          <DirectoryColumn label="Tutors" entries={directory.tutors} />
          <DirectoryColumn label="Students" entries={directory.students} />
        </div>
      </section>
    </div>
  );
}

function DirectoryColumn({
  label,
  entries,
}: {
  label: string;
  entries: DmDirectoryEntry[];
}) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-hairline/60 flex items-baseline justify-between">
        <CardLabel>{label}</CardLabel>
        <span className="text-xs text-muted tabular-nums">{entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <div className="px-5 py-6 text-sm text-ink-soft">None on file.</div>
      ) : (
        <ul className="divide-y divide-hairline/60 max-h-96 overflow-y-auto">
          {entries.map((e) => (
            <li key={e.id}>
              <Link
                href={`/admin/messages/with/${e.id}`}
                className="block px-5 py-3 text-sm text-ink hover:bg-brand-50/40 transition-colors"
              >
                {e.firstName} {e.lastName}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
