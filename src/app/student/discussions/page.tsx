import Link from "next/link";
import { MessageCircleQuestion, MessagesSquare, Sparkles } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { listAccessibleBoards } from "@/lib/discussions-queries";
import { boardSegment } from "@/lib/discussions";
import {
  colorFamilyForSubject,
  getAccentTokens,
} from "@/lib/subject-colors";

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

export default async function StudentDiscussionsPage() {
  const user = await requireRole("student");
  const boards = await listAccessibleBoards(user.id, "student");

  const generalHelp = boards.find((b) => b.id.kind === "admin");
  const subjectBoards = boards.filter((b) => b.id.kind === "subject");

  return (
    <div className="space-y-6">
      {/* Hero strip — indigo gradient, glass stat tile */}
      <section
        className="relative overflow-hidden rounded-[28px] px-8 py-8 text-white shadow-[0_20px_44px_-22px_rgba(50,58,145,0.6)]"
        style={{
          background:
            "radial-gradient(120% 140% at 0% 0%, #A0BFFC 0%, transparent 45%), radial-gradient(110% 150% at 100% 10%, #7A9BF5 0%, transparent 52%), linear-gradient(125deg, #4F5BD5 0%, #3F4AB5 58%, #2B3287 100%)",
        }}
      >
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          className="absolute -right-8 -top-10 w-[220px] h-[220px] opacity-50 pointer-events-none"
          fill="none"
        >
          <circle cx="70" cy="30" r="30" fill="rgba(255,255,255,0.10)" />
          <circle cx="70" cy="30" r="20" fill="rgba(255,255,255,0.10)" />
          <circle cx="70" cy="30" r="10" fill="rgba(255,255,255,0.12)" />
        </svg>

        <div className="relative z-10 min-w-0">
          <div className="text-[11px] uppercase tracking-[0.2em] font-bold opacity-80">
            Discussions
          </div>
          <h1 className="mt-2 text-[32px] lg:text-[36px] font-bold tracking-[-0.02em] leading-tight">
            Ask. Answer. Level up.
          </h1>
          <p className="mt-3 max-w-[480px] text-[15px] opacity-85">
            Subject boards for class questions, plus a general help board for
            everything else.
          </p>
        </div>
      </section>

      {/* General help — featured wide card with sun accent */}
      {generalHelp && (
        <Link
          href={`/student/discussions/${boardSegment(generalHelp.id)}`}
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
              style={{
                background: "var(--sun-100)",
                color: "var(--sun-600)",
              }}
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
                style={{
                  background: "var(--sun-100)",
                  color: "var(--sun-ink)",
                }}
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
              Your subject boards
            </h3>
            <span className="text-[11px] uppercase tracking-[0.14em] font-bold text-muted">
              {subjectBoards.length}{" "}
              {subjectBoards.length === 1 ? "subject" : "subjects"}
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {subjectBoards.map((b) => {
              if (b.id.kind !== "subject") return null;
              const family = colorFamilyForSubject(b.label);
              const tokens = getAccentTokens(family);
              const initial = b.label.charAt(0).toUpperCase();
              const hasActivity = b.threadCount > 0;

              return (
                <Link
                  key={b.id.subjectId}
                  href={`/student/discussions/${boardSegment(b.id)}`}
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
                      style={{
                        background: tokens.bgFrom,
                        color: tokens.arrow,
                      }}
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
                        style={{
                          background: tokens.pillBg,
                          color: tokens.pillText,
                        }}
                      >
                        {b.threadCount}{" "}
                        {b.threadCount === 1 ? "thread" : "threads"}
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
                        style={{
                          background: tokens.pillBg,
                          color: tokens.pillText,
                        }}
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
          No subject boards yet — they&apos;ll appear here once you&apos;re
          enrolled in a class.
        </div>
      )}
    </div>
  );
}
