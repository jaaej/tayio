import Link from "next/link";
import { Card, CardHead, PageHeader, Empty } from "@/components/admin/ui";
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
      <PageHeader
        className="rise"
        eyebrow="Direct messages"
        title="Messages"
        sub="Your direct conversations with parents, students, and tutors. Start a new one from the directory below."
      />

      <section className="space-y-2.5 rise" style={{ animationDelay: "60ms" }}>
        <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-muted px-1">
          Conversations
        </div>
        {threads.length === 0 ? (
          <Card>
            <Empty>
              No conversations yet. Pick someone from the directory below to
              start one.
            </Empty>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {threads.map((t) => (
                <li key={t.threadId}>
                  <ThreadRow thread={t} hrefPrefix="/admin/messages" />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section className="space-y-3 rise" style={{ animationDelay: "120ms" }}>
        <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-muted px-1">
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
    <Card>
      <CardHead
        title={label}
        action={
          <span className="text-[12px] font-bold text-muted tabular-nums">
            {entries.length}
          </span>
        }
      />
      {entries.length === 0 ? (
        <Empty>None on file.</Empty>
      ) : (
        <ul className="divide-y divide-line max-h-96 overflow-y-auto">
          {entries.map((e) => (
            <li key={e.id}>
              <Link
                href={`/admin/messages/with/${e.id}`}
                className="block px-5 py-3.5 text-[14px] font-semibold text-ink hover:bg-surface-2 hover:text-brand-700 transition-colors"
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
