import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { listMyThreads } from "@/lib/dm-queries";
import { ThreadRow } from "@/components/dm/thread-row";

export default async function TutorMessagesPage() {
  const user = await requireRole("tutor");
  const threads = await listMyThreads(user.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
          Messages
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Conversations with your students, their parents, and the admin office.
        </p>
      </header>
      {threads.length === 0 ? (
        <Card>
          <div className="py-6 text-sm text-ink-soft">
            No conversations yet.
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-hairline/60">
            {threads.map((t) => (
              <li key={t.threadId}>
                <ThreadRow thread={t} hrefPrefix="/tutor/messages" />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
