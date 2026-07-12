import Link from "next/link";
import { Building2 } from "lucide-react";
import { Card, CardBody } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { requireRole } from "@/lib/auth";
import { listMyThreads } from "@/lib/dm-queries";
import { ThreadRow } from "@/components/dm/thread-row";
import { getAdminContactForStudent } from "../_lib/queries";

export default async function StudentMessagesPage() {
  const user = await requireRole("student");
  const isUnrestricted =
    (user.app_metadata?.role as string | undefined) === "student_unrestricted";
  const [threads, adminContact] = await Promise.all([
    listMyThreads(user.id),
    isUnrestricted ? getAdminContactForStudent() : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Messages"
        title="Inbox"
        sub={
          isUnrestricted
            ? "Conversations with your tutors and the admin office."
            : "Conversations with your tutors."
        }
      />

      {adminContact && (
        <Link
          href={`/student/messages/with/${adminContact.id}`}
          className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-4 py-3 hover:border-brand-300 transition-colors"
        >
          <span className="h-9 w-9 shrink-0 grid place-items-center rounded-lg bg-brand-100 text-brand-ink">
            <Building2 className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] font-bold text-ink">
              Message the admin office
            </span>
            <span className="block text-[12px] text-muted">
              Billing, enrolment and general questions
            </span>
          </span>
        </Link>
      )}

      {threads.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-sm text-muted">
              No conversations yet. Start one from a contact card.
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {threads.map((t) => (
              <li key={t.threadId}>
                <ThreadRow thread={t} hrefPrefix="/student/messages" />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
