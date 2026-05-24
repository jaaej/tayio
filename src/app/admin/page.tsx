import Link from "next/link";
import { and, eq, gte, lte, lt, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  announcements,
  invoices,
  lessonNotes,
  lessons,
  profiles,
} from "@/db/schema";
import { Card, CardLabel, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function weekRange(now: Date) {
  const day = now.getDay(); // 0 = Sun
  const monday = startOfDay(now);
  const diff = (day + 6) % 7; // days since Mon
  monday.setDate(monday.getDate() - diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function loadStats() {
  const now = new Date();
  const today = isoDate(now);
  const { monday, sunday } = weekRange(now);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [studentRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(profiles)
    .where(and(eq(profiles.role, "student"), eq(profiles.isActive, true)));

  const [classesRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(lessons)
    .where(
      and(gte(lessons.date, isoDate(monday)), lte(lessons.date, isoDate(sunday))),
    );

  const [overdueRow] = await db
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${invoices.amount}), 0)::text`,
    })
    .from(invoices)
    .where(
      and(
        sql`${invoices.status} in ('unpaid','overdue','partially_paid')`,
        lt(invoices.dueDate, today),
      ),
    );

  // Notes pending: completed lessons in last 7 days where no lesson_notes row exists
  const [pendingNotesRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(lessons)
    .leftJoin(lessonNotes, eq(lessonNotes.lessonId, lessons.id))
    .where(
      and(
        gte(lessons.date, isoDate(sevenDaysAgo)),
        lt(lessons.date, today),
        isNull(lessonNotes.id),
      ),
    );

  const [revenueRow] = await db
    .select({
      total: sql<string>`coalesce(sum(${invoices.amount}), 0)::text`,
    })
    .from(invoices)
    .where(
      and(eq(invoices.status, "paid"), gte(invoices.issuedAt, monthStart)),
    );

  return {
    activeStudents: studentRow?.count ?? 0,
    classesThisWeek: classesRow?.count ?? 0,
    overdueCount: overdueRow?.count ?? 0,
    overdueTotal: Number(overdueRow?.total ?? 0),
    notesPending: pendingNotesRow?.count ?? 0,
    revenueMonth: Number(revenueRow?.total ?? 0),
  };
}

async function loadRecentAnnouncements() {
  return db
    .select({
      id: announcements.id,
      title: announcements.title,
      publishedAt: announcements.publishedAt,
    })
    .from(announcements)
    .orderBy(sql`${announcements.publishedAt} desc`)
    .limit(5);
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function AdminDashboard() {
  const stats = await loadStats();
  const recent = await loadRecentAnnouncements();

  const tiles = [
    {
      label: "Active students",
      value: stats.activeStudents.toString(),
      sub: "Profiles flagged active",
      href: "/admin/users",
    },
    {
      label: "Lessons this week",
      value: stats.classesThisWeek.toString(),
      sub: "Mon → Sun",
      href: "/admin/classes",
    },
    {
      label: "Overdue invoices",
      value: stats.overdueCount.toString(),
      sub: `${formatMoney(stats.overdueTotal)} outstanding`,
      href: "/admin/payments",
    },
    {
      label: "Notes pending",
      value: stats.notesPending.toString(),
      sub: "Last 7 days of past lessons",
      href: "/admin/classes",
    },
  ];

  return (
    <div className="space-y-12">
      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Operations · Live
        </div>
        <h1 className="mt-2 text-5xl lg:text-6xl font-light tracking-tight text-ink">
          The <span className="font-display">business</span> at a glance.
        </h1>
      </header>

      <section
        className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 rise"
        style={{ animationDelay: "80ms" }}
      >
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href} className="block">
            <Card className="hover:border-brand-600/50 transition-colors h-full">
              <CardLabel>{tile.label}</CardLabel>
              <CardTitle>{tile.value}</CardTitle>
              <div className="mt-4 text-xs text-muted">{tile.sub}</div>
            </Card>
          </Link>
        ))}
      </section>

      <section
        className="grid lg:grid-cols-2 gap-5 rise"
        style={{ animationDelay: "160ms" }}
      >
        <Card>
          <CardLabel>Revenue · this month</CardLabel>
          <CardTitle>{formatMoney(stats.revenueMonth)}</CardTitle>
          <div className="mt-6 text-xs text-muted">
            Sum of invoices marked paid since the 1st.
          </div>
        </Card>

        <Card>
          <CardLabel>Recent announcements</CardLabel>
          <div className="mt-4 divide-y divide-hairline">
            {recent.length === 0 && (
              <div className="py-3 text-sm text-muted">
                Nothing published yet —{" "}
                <Link
                  className="text-brand-600 hover:underline"
                  href="/admin/announcements"
                >
                  send your first
                </Link>
                .
              </div>
            )}
            {recent.map((a) => (
              <div
                key={a.id}
                className="py-3 text-sm text-ink-soft flex items-center justify-between gap-4"
              >
                <span className="truncate">{a.title}</span>
                <span className="text-[11px] uppercase tracking-[0.16em] text-muted shrink-0">
                  {new Date(a.publishedAt).toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <div className="text-xs text-muted">
        Admin portal · jump into{" "}
        <Link className="text-brand-600 hover:underline" href="/admin/users">
          users
        </Link>{" "}
        ·{" "}
        <Link className="text-brand-600 hover:underline" href="/admin/classes">
          classes
        </Link>{" "}
        ·{" "}
        <Link className="text-brand-600 hover:underline" href="/admin/enrolments">
          enrolments
        </Link>{" "}
        ·{" "}
        <Link className="text-brand-600 hover:underline" href="/admin/payments">
          payments
        </Link>{" "}
        ·{" "}
        <Link
          className="text-brand-600 hover:underline"
          href="/admin/announcements"
        >
          announcements
        </Link>
        .
      </div>
    </div>
  );
}
