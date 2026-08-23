import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  Download,
  FileText,
  MessageSquareText,
  PenLine,
  Trophy,
  Upload,
} from "lucide-react";
import { db } from "@/db/client";
import { homeworkAssignments } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDueDate } from "@/lib/format";
import { HOMEWORK_STATUS_LABEL } from "@/lib/status";
import { colorFamilyForSubject, getAccentTokens } from "@/lib/subject-colors";
import {
  getHomeworkDetail,
  getStudentTestRank,
} from "../../_lib/queries";
import { HOMEWORK_BUCKET, signHomeworkAttachment } from "../_storage";

export default async function HomeworkDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const { id } = await params;
  const { submitted, error } = await searchParams;
  const user = await requireRole("student");
  const hw = await getHomeworkDetail(user.id, id);
  if (!hw) notFound();

  // Mark as viewed on first open.
  let effectiveStatus = hw.status;
  if (effectiveStatus === "not_started") {
    await db
      .update(homeworkAssignments)
      .set({ status: "viewed" })
      .where(
        and(
          eq(homeworkAssignments.homeworkId, id),
          eq(homeworkAssignments.studentId, user.id),
        ),
      );
    effectiveStatus = "viewed";
  }

  const supabase = await createClient();
  const submissionLink = await signedSubmissionLink(supabase, hw.submissionUrl);
  const attachmentHref = await signHomeworkAttachment(supabase, hw.attachmentUrl);

  // effectiveStatus is "not_started" → "viewed" by now, so omit it here.
  const canSubmit =
    effectiveStatus === "viewed" ||
    effectiveStatus === "resubmission_requested" ||
    (effectiveStatus === "submitted" && hw.allowResubmission) ||
    (effectiveStatus === "late" && hw.allowResubmission);

  const isOverdue = !hw.submittedAt && hw.dueDate < new Date();

  // Test rank - only fetched when this homework is flagged as a test and the
  // student has been marked. Anonymous: returns rank + total only.
  const testRank =
    hw.isTest && hw.score !== null
      ? await getStudentTestRank(user.id, id)
      : null;

  const tokens = getAccentTokens(colorFamilyForSubject(hw.subjectName ?? ""));
  const statusLabel = HOMEWORK_STATUS_LABEL[effectiveStatus] ?? effectiveStatus;

  return (
    <div className="space-y-4 max-w-[860px]">
      <Link
        href="/student/subjects"
        className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] font-bold text-ink-soft hover:text-ink transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        All homework
      </Link>

      {submitted && (
        <Banner
          tone="good"
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
          text="Submission received. Your tutor will mark it soon."
        />
      )}
      {error && (
        <Banner
          tone="bad"
          icon={<AlertCircle className="h-4 w-4" aria-hidden />}
          text={`Couldn't upload: ${decodeURIComponent(error)}`}
        />
      )}

      {/* HERO - subject-coloured */}
      <section
        className="relative overflow-hidden rounded-[24px] px-6 py-6 text-white shadow-[0_16px_36px_-20px_rgba(31,40,90,0.5)]"
        style={{
          background: `radial-gradient(140% 160% at 0% 0%, ${withAlpha(tokens.bgFrom, 0.6)} 0%, transparent 46%), radial-gradient(120% 150% at 100% 0%, ${withAlpha(tokens.bgFrom, 0.36)} 0%, transparent 55%), linear-gradient(135deg, ${tokens.arrow} 0%, ${tokens.title} 100%)`,
        }}
      >
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          className="absolute -right-8 -top-12 w-[210px] h-[210px] opacity-50 pointer-events-none"
          fill="none"
        >
          <circle cx="70" cy="30" r="34" fill="rgba(255,255,255,0.12)" />
          <circle cx="70" cy="30" r="22" fill="rgba(255,255,255,0.10)" />
          <circle cx="70" cy="30" r="11" fill="rgba(255,255,255,0.14)" />
        </svg>

        <div className="relative z-10 flex items-start justify-between gap-5 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.18em] font-extrabold opacity-85">
              {hw.className ?? "Homework"}
            </div>
            <h1 className="m-0 mt-1 text-[24px] lg:text-[28px] font-extrabold tracking-[-0.02em] leading-tight">
              {hw.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <HeroChip icon={<Clock3 />}>Due {formatDueDate(hw.dueDate)}</HeroChip>
              {isOverdue && <HeroChip strong>Overdue</HeroChip>}
              <HeroChip>{statusLabel}</HeroChip>
              {hw.isTest && <HeroChip icon={<Trophy className="h-3 w-3" />}>Test</HeroChip>}
            </div>
          </div>

          {hw.score && (
            <div className="shrink-0 rounded-[16px] bg-white/15 border border-white/25 px-5 py-3 text-center backdrop-blur-sm">
              <div className="text-[10px] uppercase tracking-[0.16em] font-extrabold opacity-85">
                Score
              </div>
              <div className="mt-0.5 text-[26px] font-extrabold tabular-nums leading-none">
                {hw.score}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* INSTRUCTIONS */}
      {hw.description && (
        <SectionCard
          tokens={tokens}
          icon={<ClipboardList className="h-4 w-4" />}
          title="Instructions"
        >
          <div className="text-[14px] text-ink whitespace-pre-wrap leading-relaxed">
            {hw.description}
          </div>
        </SectionCard>
      )}

      {/* WORKSHEET */}
      {attachmentHref && (
        <SectionCard
          tokens={tokens}
          icon={<FileText className="h-4 w-4" />}
          title="Worksheet"
        >
          <a
            href={attachmentHref}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-3 rounded-[14px] border border-line bg-background px-4 py-3 transition-colors hover:bg-surface-2"
          >
            <span
              className="h-10 w-10 rounded-[11px] grid place-items-center shrink-0"
              style={{ background: tokens.bgFrom, color: tokens.arrow }}
            >
              <FileText className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-bold text-ink">
                Homework worksheet
              </span>
              <span className="block text-[12px] text-muted">
                Provided by your tutor
              </span>
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold text-white shrink-0"
              style={{ background: tokens.arrow }}
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Download
            </span>
          </a>
        </SectionCard>
      )}

      {/* TUTOR FEEDBACK */}
      {(hw.feedback || hw.score) && (
        <SectionCard
          tokens={tokens}
          icon={<MessageSquareText className="h-4 w-4" />}
          title="Tutor feedback"
          accentTop
        >
          <div className="space-y-3">
            {(hw.score || testRank) && (
              <div className="flex flex-wrap items-center gap-2.5">
                {hw.score && (
                  <span
                    className="inline-flex items-baseline gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold tabular-nums"
                    style={{ background: tokens.pillBg, color: tokens.pillText }}
                  >
                    Score <span className="text-[15px]">{hw.score}</span>
                  </span>
                )}
                {testRank && (
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
                    style={{ background: tokens.pillBg, color: tokens.pillText }}
                  >
                    <Trophy className="h-4 w-4" aria-hidden />
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em]">
                      Test rank
                    </span>
                    <span className="text-[14px] font-bold tabular-nums">
                      #{testRank.rank}
                      <span className="opacity-70 text-[12px]"> / {testRank.total}</span>
                    </span>
                  </span>
                )}
              </div>
            )}
            {hw.feedback && (
              <div className="text-[14px] text-ink whitespace-pre-wrap leading-relaxed">
                {hw.feedback}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* YOUR SUBMISSION */}
      <SectionCard
        tokens={tokens}
        icon={<PenLine className="h-4 w-4" />}
        title="Your submission"
      >
        <div className="space-y-4">
          {hw.submittedAt && (
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-good-bg text-good px-2.5 py-1 text-[11px] font-bold">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                Submitted {hw.submittedAt.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
              </span>
              {submissionLink && (
                <a
                  href={submissionLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-background px-3 py-1 text-[12px] font-bold text-ink hover:bg-surface-2 transition-colors"
                >
                  <FileText className="h-3.5 w-3.5" style={{ color: tokens.arrow }} aria-hidden />
                  View file
                </a>
              )}
            </div>
          )}

          {hw.submissionText && (
            <div
              className="text-[14px] text-ink whitespace-pre-wrap leading-relaxed rounded-[12px] bg-surface-2 px-4 py-3 border-l-[3px]"
              style={{ borderLeftColor: tokens.arrow }}
            >
              {hw.submissionText}
            </div>
          )}

          {canSubmit ? (
            <form
              action={`/api/student/homework/${id}/submit`}
              method="post"
              encType="multipart/form-data"
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="submission-file"
                  className="block text-[11px] uppercase tracking-[0.16em] font-bold text-muted mb-2"
                >
                  Upload your work
                </label>
                <div
                  className="rounded-[14px] border-2 border-dashed p-4 flex items-center gap-3"
                  style={{ borderColor: tokens.ring, background: tokens.bgTo }}
                >
                  <span
                    className="h-10 w-10 rounded-[11px] grid place-items-center shrink-0"
                    style={{ background: tokens.bgFrom, color: tokens.arrow }}
                  >
                    <Upload className="h-5 w-5" aria-hidden />
                  </span>
                  <input
                    id="submission-file"
                    name="file"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt,.heic"
                    className="block w-full text-[13px] text-ink file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3.5 file:py-2 file:text-[13px] file:font-bold file:text-ink hover:file:bg-surface-2 file:cursor-pointer cursor-pointer"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-muted">
                  PDF, image, or document · 10 MB max
                </p>
              </div>

              <div>
                <label
                  htmlFor="submission-text"
                  className="block text-[11px] uppercase tracking-[0.16em] font-bold text-muted mb-2"
                >
                  Or type your answer
                </label>
                <textarea
                  id="submission-text"
                  name="text"
                  rows={5}
                  className="w-full rounded-[14px] border border-line bg-surface px-4 py-3 text-[14px] text-ink placeholder:text-muted focus:outline-none focus:border-line-strong transition-colors"
                  placeholder="Write your answer here…"
                />
              </div>

              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold text-white transition-transform hover:-translate-y-[1px] shadow-[0_10px_24px_-12px_rgba(31,40,90,0.5)]"
                style={{ background: tokens.arrow }}
              >
                <Upload className="h-4 w-4" aria-hidden />
                {hw.submittedAt ? "Resubmit" : "Submit homework"}
              </button>
            </form>
          ) : (
            <div className="rounded-[12px] bg-surface-2 px-4 py-3 text-[13px] text-ink-soft">
              {effectiveStatus === "marked" || effectiveStatus === "returned"
                ? "This homework has been marked - no further submissions needed."
                : "Submissions are closed for this homework."}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

function SectionCard({
  tokens,
  icon,
  title,
  accentTop,
  children,
}: {
  tokens: ReturnType<typeof getAccentTokens>;
  icon: React.ReactNode;
  title: string;
  accentTop?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[20px] border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,17,30,0.04),0_8px_24px_-18px_rgba(31,40,90,0.16)]">
      {accentTop && (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: tokens.arrow }}
        />
      )}
      <div className="flex items-center gap-2.5 mb-3">
        <span
          className="h-8 w-8 rounded-[10px] grid place-items-center shrink-0"
          style={{ background: tokens.bgFrom, color: tokens.arrow }}
        >
          {icon}
        </span>
        <h2 className="m-0 text-[15px] font-extrabold tracking-[-0.01em] text-ink">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function HeroChip({
  icon,
  strong,
  children,
}: {
  icon?: React.ReactNode;
  strong?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border " +
        (strong
          ? "bg-white/95 border-white text-ink"
          : "bg-white/15 border-white/30 text-white")
      }
    >
      {icon}
      {children}
    </span>
  );
}

function Clock3() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function Banner({
  tone,
  icon,
  text,
}: {
  tone: "good" | "bad";
  icon: React.ReactNode;
  text: string;
}) {
  const cls =
    tone === "good"
      ? "border-good/40 bg-good-bg text-good"
      : "border-bad/40 bg-bad-bg text-bad";
  return (
    <div className={`flex items-center gap-2.5 rounded-[14px] border px-4 py-3 text-[13px] font-semibold ${cls}`}>
      {icon}
      {text}
    </div>
  );
}

function withAlpha(rgb: string, a: number): string {
  // Input format is "rgb(r, g, b)" from AccentTokens.bgFrom etc.
  const match = rgb.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (!match) return rgb;
  return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${a})`;
}

async function signedSubmissionLink(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = await supabase.storage
    .from(HOMEWORK_BUCKET)
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
