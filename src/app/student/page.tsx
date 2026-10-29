import Link from "next/link";
import { accountFirstName } from "@/lib/account-name";
import { requireRole } from "@/lib/auth";
import { subjectTone } from "@/lib/subject-tone";
import { getStudentDashboard } from "./_lib/dashboard";
import { relativeDay, type StudentTodo } from "./_lib/dashboard-rules";

export const dynamic = "force-dynamic";

/*
 * Student dashboard, colourful option of the student design handoff
 * (StudentDashboardColourPage): violet hero, solid subject cards with a
 * this-week ring, the Taiyo Blitz card, To do and This week.
 */

const HERO = "#5B2BD8";
const BLITZ = "#3B2BD1";

/** Scattered maths symbols behind the Blitz card (the handoff's blitzSvg). */
function blitzBackground(base: string) {
  const sym = ["+", "−", "×", "÷", "=", "+", "×", "−", "÷", "="];
  let g = "";
  for (let i = 0; i < 10; i++) {
    const x = ((i * 53) % 220) + 10;
    const y = ((i * 89) % 220) + 26;
    const r = ((i * 37) % 50) - 25;
    const fill = i % 4 === 0 ? "rgba(255,214,0,0.35)" : "rgba(255,255,255,0.12)";
    g += `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-weight="700" font-size="${
      22 + (i % 3) * 10
    }" fill="${fill}" transform="rotate(${r} ${x} ${y})">${sym[i]}</text>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">${g}</svg>`;
  return `${base} url("data:image/svg+xml,${encodeURIComponent(svg)}") repeat`;
}

const PILL = {
  due: { bg: "#FFF1DC", fg: "#8A4A06" },
  overdue: { bg: "#FDE8E8", fg: "#B42318" },
  video: { bg: "#E4F0FF", fg: "#1E4FB8" },
  quiz: { bg: "#EEEBFD", fg: "#3A1AA8" },
  new: { bg: "#E3F7EE", fg: "#0B6B47" },
};

function todoPill(row: StudentTodo, todayIso: string) {
  switch (row.kind) {
    case "overdue":
      return { label: "Overdue", ...PILL.overdue };
    case "resubmit":
      return { label: "Resubmit", ...PILL.due };
    case "due-soon":
    case "due-later": {
      return {
        label: row.dueDay ? `Due ${relativeDay(row.dueDay, todayIso)}` : "Due",
        ...PILL.due,
      };
    }
    case "video":
      return { label: "Video", ...PILL.video };
    case "quiz":
      return { label: "Quiz", ...PILL.quiz };
    case "marked":
      return { label: "New", ...PILL.new };
    case "payment":
      return { label: "Invoice", ...PILL.due };
  }
}

export default async function StudentDashboard() {
  const user = await requireRole("student");
  const isUnrestricted =
    (user.app_metadata?.role as string | undefined) === "student_unrestricted";
  const now = new Date();
  const dashboard = await getStudentDashboard(user.id, { isUnrestricted, now });

  const firstName = accountFirstName(user, "there");
  const dateLabel = new Date(`${dashboard.todayIso}T12:00:00`).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="flex flex-col gap-5 text-ink">
      {/* Hero */}
      <section
        aria-labelledby="hi-h"
        className="flex flex-wrap items-center justify-between gap-5 rounded-[28px] px-7 py-[26px] text-white"
        style={{ background: HERO }}
      >
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold opacity-80">
            {dateLabel}
            {dashboard.termLabel ? ` · ${dashboard.termLabel}` : ""}
          </span>
          <h1 id="hi-h" className="m-0 text-[34px] font-extrabold tracking-[-0.01em]">
            Hey {firstName}
          </h1>
          {dashboard.status && (
            <span className="text-[15px] font-semibold opacity-[0.92]">{dashboard.status}</span>
          )}
        </div>
        {dashboard.nextHomework && (
          <Link
            href={dashboard.nextHomework.href}
            className="flex h-12 items-center rounded-[14px] bg-white px-5 text-[15px] font-extrabold text-[#3A1AA8] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-[3px] hover:text-[#3A1AA8] hover:shadow-[0_16px_30px_rgba(23,21,43,0.16)]"
          >
            {dashboard.nextHomework.label}
          </Link>
        )}
      </section>

      <div className="flex flex-wrap items-stretch gap-5">
        {/* Subject cards */}
        <section
          aria-label="Your subjects"
          className="grid min-w-0 flex-[999_1_520px] gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(250px,100%),1fr))]"
        >
          {dashboard.subjects.map((s) => {
            const bg = subjectTone(s.subjectName, s.subjectColor).flat;
            const pct = s.weekTotal > 0 ? Math.round((s.weekDone / s.weekTotal) * 100) : 0;
            return (
              <Link
                key={s.subjectId}
                href={`/student/subjects/${s.subjectId}`}
                className="flex flex-col gap-3.5 rounded-[24px] p-5 text-white transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-[3px] hover:text-white hover:shadow-[0_16px_30px_rgba(23,21,43,0.16)]"
                style={{ background: bg }}
              >
                <span className="flex items-center justify-between gap-2.5">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[20px] font-extrabold">{s.subjectName}</span>
                    <span className="text-[13px] font-semibold opacity-90">{s.tutorName}</span>
                  </span>
                  {s.weekTotal > 0 && (
                    <span
                      className="grid h-[60px] w-[60px] flex-none place-items-center rounded-full"
                      style={{
                        background: `conic-gradient(#FFFFFF ${pct}%, rgba(255,255,255,.25) 0)`,
                      }}
                    >
                      <span
                        className="grid h-12 w-12 place-items-center rounded-full text-[13px] font-extrabold"
                        style={{ background: bg }}
                      >
                        {s.weekDone}/{s.weekTotal}
                      </span>
                    </span>
                  )}
                </span>
                {s.thisWeek && (
                  <span className="flex flex-col gap-0.5 rounded-[16px] bg-white/[0.16] px-3.5 py-3">
                    <span className="text-[11px] font-extrabold tracking-[0.08em] opacity-85">
                      THIS WEEK
                    </span>
                    <span className="text-[15px] font-extrabold">{s.thisWeek}</span>
                  </span>
                )}
              </Link>
            );
          })}
        </section>

        {/* Blitz */}
        <Link
          href="/student/math-game"
          className="flex min-w-[260px] max-w-[360px] flex-[1_1_280px] flex-col gap-2.5 rounded-[24px] p-5 text-white transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-[3px] hover:text-white hover:shadow-[0_16px_30px_rgba(23,21,43,0.16)]"
          style={{ background: blitzBackground(BLITZ) }}
        >
          <span className="text-[12px] font-extrabold tracking-[0.12em] text-[#FFD600]">
            TAIYO BLITZ
          </span>
          <span className="text-[26px] font-extrabold leading-[1.15]">
            {dashboard.blitz.yearRank && dashboard.blitz.yearLabel
              ? `#${dashboard.blitz.yearRank} in ${dashboard.blitz.yearLabel}`
              : "Play your first round"}
          </span>
          {dashboard.blitz.best && (
            <span className="text-[14px] font-semibold opacity-90">{dashboard.blitz.best}</span>
          )}
          <span className="mt-auto flex h-[46px] items-center justify-center rounded-[14px] bg-[#FFD600] text-[16px] font-extrabold text-[#1B1240] shadow-[0_6px_0_#C9A800]">
            Play
          </span>
        </Link>
      </div>

      <div className="flex flex-wrap items-stretch gap-5">
        {/* To do */}
        <section
          aria-labelledby="td-h"
          className="glass min-w-0 flex-[999_1_460px] rounded-[24px] p-1.5"
        >
          <div className="flex items-center justify-between px-3 pb-3 pt-2.5">
            <h2 id="td-h" className="m-0 text-[17px] font-extrabold">
              To do
            </h2>
            <span className="text-[13px] font-bold text-ink-soft">
              {dashboard.todo.reduce((sum, row) => sum + row.count, 0)}
            </span>
          </div>
          <div className="panel overflow-hidden">
            {dashboard.todo.length === 0 ? (
              <p className="px-4 py-8 text-center text-[14px] text-muted">
                All caught up. Nothing is due.
              </p>
            ) : (
              dashboard.todo.map((t) => {
                const pill = todoPill(t, dashboard.todayIso);
                return (
                  <Link
                    key={t.key}
                    href={t.href}
                    className="flex items-center gap-3.5 border-b border-[#EFF0F5] px-4 py-3.5 text-ink last:border-b-0 hover:bg-[#F8F9FC] hover:text-ink"
                  >
                    <span
                      className="h-3 w-3 flex-none rounded-[4px]"
                      style={{
                        background: t.subjectName
                          ? subjectTone(t.subjectName, t.subjectColor).flat
                          : "#8A4A06",
                      }}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[15px] font-extrabold">{t.title}</span>
                      <span className="text-[13px] font-semibold text-[#5E5A73]">{t.detail}</span>
                    </span>
                    <span
                      className="flex h-7 items-center whitespace-nowrap rounded-[14px] px-3 text-[12px] font-extrabold"
                      style={{ background: pill.bg, color: pill.fg }}
                    >
                      {pill.label}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </section>

        {/* Week */}
        <section
          aria-labelledby="wk-h"
          className="glass min-w-[300px] max-w-[460px] flex-[1_1_360px] rounded-[24px] p-1.5"
        >
          <div className="flex items-center justify-between px-3 pb-3 pt-2.5">
            <h2 id="wk-h" className="m-0 text-[17px] font-extrabold">
              This week
            </h2>
            <Link href="/student/timetable" className="text-[13px] font-bold text-[#3A1AA8] hover:text-[#21106B]">
              Timetable
            </Link>
          </div>
          <div className="panel overflow-hidden">
            {dashboard.week.map((d) => (
              <div
                key={d.iso}
                className="flex items-center gap-3 border-b border-[#EFF0F5] px-3.5 py-2.5 last:border-b-0"
                style={{
                  background: d.isToday ? HERO : "#FFFFFF",
                  color: d.isToday ? "#FFFFFF" : "#17152B",
                }}
              >
                <span className="flex w-10 flex-none flex-col items-center leading-[1.1]">
                  <span className="text-[11px] font-extrabold uppercase opacity-75">{d.weekday}</span>
                  <span className="text-[19px] font-extrabold">{d.dayNumber}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  {d.lessons.map((l) => {
                    const tone = subjectTone(l.subjectName, l.subjectColor);
                    const onToday = d.isToday;
                    return (
                      <span
                        key={l.id}
                        className="flex h-7 items-center whitespace-nowrap rounded-[14px] px-2.5 text-[12px] font-extrabold"
                        style={
                          onToday
                            ? { background: "#FFFFFF", color: HERO }
                            : { background: tone.bg, color: tone.fg }
                        }
                      >
                        {l.label}
                      </span>
                    );
                  })}
                  {d.due.map((h) => (
                    <Link
                      key={h.homeworkId}
                      href={`/student/homework/${h.homeworkId}`}
                      className="flex h-7 max-w-full items-center rounded-[14px] bg-[#FFF1DC] px-2.5 text-[12px] font-extrabold text-[#8A4A06] hover:text-[#8A4A06]"
                    >
                      <span className="truncate">Due: {h.title}</span>
                    </Link>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
