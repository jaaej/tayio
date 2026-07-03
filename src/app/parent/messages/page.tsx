import { Card, PageHeader, Empty } from "@/components/parent/ui";
import { requireRole } from "@/lib/auth";
import { listMyThreads } from "@/lib/dm-queries";
import { ThreadRow } from "@/components/dm/thread-row";

export default async function ParentMessagesPage() {
  const user = await requireRole("parent");
  const threads = await listMyThreads(user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        sub="Conversations with your child's tutors and the admin office."
      />
      {threads.length === 0 ? (
        <Card>
          <Empty>No conversations yet. Start one from a contact card.</Empty>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line/70">
            {threads.map((t) => (
              <li key={t.threadId}>
                <ThreadRow thread={t} hrefPrefix="/parent/messages" />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
