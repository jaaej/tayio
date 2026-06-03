import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { listMyThreads } from "@/lib/dm-queries";
import { ThreadRow } from "@/components/dm/thread-row";
import { PageHeader } from "../_components/page-header";

export default async function ParentMessagesPage() {
  const user = await requireRole("parent");
  const threads = await listMyThreads(user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Direct messages"
        title="Messages"
        sub="Conversations with your child's tutors and the admin office."
      />
      {threads.length === 0 ? (
        <Card>
          <div className="py-6 text-sm text-ink-soft">
            No conversations yet. Start one from a contact card.
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-hairline/60">
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
