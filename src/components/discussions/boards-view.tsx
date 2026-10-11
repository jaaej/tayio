import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import type {
  BoardSummary,
  RecentThreadSummary,
} from "@/lib/discussions-queries";
import { boardSegment } from "@/lib/discussions";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SubjectDot } from "@/components/admin/ui/glass";
import { NewThreadButton } from "./new-thread-panel";
import { ThreadListPanel } from "./thread-list-panel";
import type { DiscussionRole } from "./role-tone";

function formatActivity(d: Date | null, now: Date): string {
  if (!d) return "No activity yet";
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days <= 0) return "Active today";
  if (days === 1) return "Active yesterday";
  if (days < 7) return `Active ${days}d ago`;
  if (days < 30) return `Active ${Math.floor(days / 7)}w ago`;
  return `Active ${d.toLocaleDateString("en-AU", { timeZone: "Australia/Melbourne", day: "numeric", month: "short" })}`;
}

function threadCount(n: number): string {
  return n === 0 ? "No threads yet" : `${n} ${n === 1 ? "thread" : "threads"}`;
}

/**
 * Shared discussions landing view - one design across every role so the
 * feature looks identical for students, tutors, and admins. Only the href
 * prefix varies: boards on the left (general help featured, subject boards
 * below), cross-board recent activity on the right.
 */
export function DiscussionsBoardsView({
  boards,
  recentThreads,
  hrefPrefix,
  rolePrefix,
}: {
  boards: BoardSummary[];
  recentThreads: RecentThreadSummary[];
  hrefPrefix: string;
  rolePrefix: DiscussionRole;
}) {
  const now = new Date();
  const generalHelp = boards.find((b) => b.id.kind === "admin");
  const subjectBoards = boards.filter((b) => b.id.kind === "subject");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Discussions"
        actions={
          <NewThreadButton
            boards={boards.map((b) => ({ segment: boardSegment(b.id), label: b.label }))}
            rolePrefix={rolePrefix}
          />
        }
      />

      <div className="flex flex-wrap items-start gap-5">
        <section
          aria-labelledby="boards-heading"
          className="glass flex min-w-0 flex-[999_1_480px] flex-col rounded-[24px] p-1.5"
        >
          <div className="flex min-h-12 items-center px-3 py-1.5">
            <h2 id="boards-heading" className="text-[16px] font-extrabold text-ink">
              Boards
            </h2>
          </div>
          <div className="flex flex-col gap-1.5">
            {generalHelp && (
              <Link
                href={`${hrefPrefix}/${boardSegment(generalHelp.id)}`}
                className="flex items-center gap-3.5 rounded-[16px] bg-ink p-[18px] text-white shadow-[0_1px_2px_rgba(23,21,43,0.06)] transition-transform duration-150 hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-white/[0.14]">
                  <MessagesSquare className="h-5 w-5" strokeWidth={1.8} aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[16px] font-extrabold">{generalHelp.label}</span>
                  <span className="text-[13px] text-white/80">
                    Open to all subjects · {threadCount(generalHelp.threadCount)}
                  </span>
                </span>
                <ActivityPill at={generalHelp.lastActivityAt} now={now} />
              </Link>
            )}
            {subjectBoards.length > 0 ? (
              <ul className="panel grid grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))] gap-0.5 p-1.5">
                {subjectBoards.map((b) => (
                  <li key={boardSegment(b.id)}>
                    <Link
                      href={`${hrefPrefix}/${boardSegment(b.id)}`}
                      className="flex items-center gap-2.5 rounded-[11px] p-3 text-ink transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                    >
                      <SubjectDot subject={b.label} className="h-2.5 w-2.5" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[14px] font-bold">{b.label}</span>
                        <span className="text-[12px] text-muted">
                          {threadCount(b.threadCount)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel px-6 py-8 text-center text-[13px] text-muted">
                No subject boards yet.
              </p>
            )}
          </div>
        </section>

        <ThreadListPanel
          title="Recent activity"
          className="flex-[1_1_360px] lg:max-w-[460px]"
          threads={recentThreads.map((t) => ({
            ...t,
            href: `${hrefPrefix}/${boardSegment(t.board)}/${t.id}`,
          }))}
          searchLabel="Search recent threads"
          searchPlaceholder="Search questions, names or boards…"
          empty={{ title: "No threads yet", hint: "Open a board to start the first one." }}
        />
      </div>
    </div>
  );
}

function ActivityPill({ at, now }: { at: Date | null; now: Date }) {
  const label = formatActivity(at, now);
  const today = label === "Active today";
  return (
    <span
      className={`hidden h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] font-extrabold sm:inline-flex ${
        today ? "bg-good-bg text-good" : "bg-white/[0.14] text-white"
      }`}
    >
      {label}
    </span>
  );
}
