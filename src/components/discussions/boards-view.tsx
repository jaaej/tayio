import Link from "next/link";
import { MessageCircleQuestion, MessagesSquare, Sparkles } from "lucide-react";
import type {
  BoardSummary,
  RecentThreadSummary,
} from "@/lib/discussions-queries";
import { boardSegment } from "@/lib/discussions";
import { colorFamilyForSubject, getAccentTokens } from "@/lib/subject-colors";
import { PageHero } from "@/components/ui/page-hero";
import { RecentThreads } from "@/components/discussions/recent-threads";
import type { DiscussionRole } from "@/components/discussions/role-tone";

function formatActivity(d: Date | null): string {
  if (!d) return "No activity yet";
  const ms = Date.now() - d.getTime();
  const days = Math.floor(ms / 86400000);
  if (days <= 0) return "Active today";
  if (days === 1) return "Active yesterday";
  if (days < 7) return `Active ${days}d ago`;
  if (days < 30) return `Active ${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

/**
 * Shared discussions landing view - one design across every role so the
 * feature looks identical for students, tutors, and admins. Only the hero
 * copy and the href prefix vary; the hero, the featured general-help card,
 * and the subject-board grid are the same everywhere.
 */
export function DiscussionsBoardsView({
  boards,
  recentThreads,
  hrefPrefix,
  title,
  subtitle,
  userFirstName,
  rolePrefix,
}: {
  boards: BoardSummary[];
  recentThreads: RecentThreadSummary[];
  hrefPrefix: string;
  title: string;
  subtitle?: string;
  userFirstName: string;
  rolePrefix: DiscussionRole;
}) {
  const generalHelp = boards.find((b) => b.id.kind === "admin");
  const subjectBoards = boards.filter((b) => b.id.kind === "subject");

  return (
    <div className="space-y-6">
      <PageHero eyebrow="Discussions" title={title} subtitle={subtitle} />

      {/* General help - featured wide card with sun accent */}
      {generalHelp && (
        <Link
          href={`${hrefPrefix}/${boardSegment(generalHelp.id)}`}
          className="group relative block bg-surface border border-line rounded-[22px] p-7 overflow-hidden transition-all duration-150 hover:-translate-y-[3px] hover:shadow-[0_24px_60px_-20px_rgba(31,40,90,0.25)]"
        >
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-1.5"
            style={{ background: "var(--sun-500)" }}
          />
          <div
            aria-hidden
            className="absolute -right-10 -top-12 w-[200px] h-[200px] rounded-full opacity-60 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, var(--sun-100), transparent 70%)",
            }}
          />
          <div className="relative flex items-center gap-6">
            <div
              className="h-[68px] w-[68px] rounded-[18px] grid place-items-center shrink-0"
              style={{ background: "var(--sun-100)", color: "var(--sun-600)" }}
            >
              <MessageCircleQuestion className="h-8 w-8" strokeWidth={2.25} />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="text-[11px] uppercase tracking-[0.18em] font-bold"
                style={{ color: "var(--sun-600)" }}
              >
                Open to all subjects
              </div>
              <div className="mt-1 text-[22px] font-bold text-ink tracking-[-0.01em] leading-tight">
                {generalHelp.label}
              </div>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-2 shrink-0">
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-bold tabular-nums"
                style={{ background: "var(--sun-100)", color: "var(--sun-ink)" }}
              >
                {generalHelp.threadCount}{" "}
                {generalHelp.threadCount === 1 ? "thread" : "threads"}
              </span>
              <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted">
                {formatActivity(generalHelp.lastActivityAt)}
              </span>
            </div>
          </div>
        </Link>
      )}

      {/* Subject boards grid */}
      {subjectBoards.length > 0 ? (
        <section>
          <div className="flex items-end justify-between mb-4 px-1">
            <h3 className="m-0 text-[18px] font-bold tracking-[-0.01em] text-ink">
              Subject boards
            </h3>
            <span className="text-[11px] uppercase tracking-[0.14em] font-bold text-ink-soft">
              {subjectBoards.length}{" "}
              {subjectBoards.length === 1 ? "subject" : "subjects"}
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {subjectBoards.map((b) => {
              if (b.id.kind !== "subject") return null;
              const tokens = getAccentTokens(colorFamilyForSubject(b.label));
              const initial = b.label.charAt(0).toUpperCase();
              const hasActivity = b.threadCount > 0;

              return (
                <Link
                  key={b.id.subjectId}
                  href={`${hrefPrefix}/${boardSegment(b.id)}`}
                  className="group relative block bg-surface border border-line rounded-[22px] p-6 overflow-hidden transition-all duration-150 hover:-translate-y-[3px] hover:shadow-[0_24px_60px_-20px_rgba(31,40,90,0.25)]"
                >
                  <div
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-1.5"
                    style={{ background: tokens.arrow }}
                  />
                  <div className="mt-1.5 flex items-center justify-between">
                    <div
                      className="h-[54px] w-[54px] rounded-[16px] grid place-items-center text-[22px] font-bold"
                      style={{ background: tokens.bgFrom, color: tokens.arrow }}
                    >
                      {initial}
                    </div>
                    <MessagesSquare
                      className="h-5 w-5"
                      style={{ color: tokens.arrow, opacity: 0.55 }}
                      aria-hidden
                    />
                  </div>
                  <div className="mt-4 text-[11px] uppercase tracking-[0.16em] font-bold text-muted">
                    Subject board
                  </div>
                  <div className="mt-1.5 text-[18px] font-bold text-ink leading-tight tracking-[-0.01em]">
                    {b.label}
                  </div>
                  <div className="mt-4 pt-4 border-t border-line flex items-center justify-between">
                    {hasActivity ? (
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tabular-nums"
                        style={{ background: tokens.pillBg, color: tokens.pillText }}
                      >
                        {b.threadCount}{" "}
                        {b.threadCount === 1 ? "thread" : "threads"}
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
                        style={{ background: tokens.pillBg, color: tokens.pillText }}
                      >
                        <Sparkles className="h-3 w-3" aria-hidden /> Start one
                      </span>
                    )}
                    <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted">
                      {formatActivity(b.lastActivityAt)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="rounded-[22px] border border-line bg-surface p-8 text-center text-[13px] text-muted">
          No subject boards yet.
        </div>
      )}

      <RecentThreads
        threads={recentThreads}
        hrefPrefix={hrefPrefix}
        boards={boards.map((b) => ({
          segment: boardSegment(b.id),
          label: b.label,
        }))}
        userFirstName={userFirstName}
        rolePrefix={rolePrefix}
      />
    </div>
  );
}
