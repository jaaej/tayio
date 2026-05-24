import Link from "next/link";
import { Wordmark, LogoCard } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";

const ROLES = [
  {
    role: "Student",
    href: "/login?role=student",
    line: "Lessons, homework, progress.",
  },
  {
    role: "Parent",
    href: "/login?role=parent",
    line: "Attendance, feedback, payments.",
  },
  {
    role: "Tutor",
    href: "/login?role=tutor",
    line: "Classes, students, notes.",
  },
  {
    role: "Admin",
    href: "/login?role=admin",
    line: "Operations, billing, reports.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-hairline">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 h-16 flex items-center justify-between">
          <Wordmark />
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 grain">
        <section className="mx-auto max-w-7xl px-6 lg:px-10 pt-20 pb-24 lg:pt-32 lg:pb-32">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-end">
            <div className="lg:col-span-7 rise">
              <div className="flex items-center gap-3 mb-8">
                <span className="h-2 w-2 rounded-full bg-brand-600" />
                <span className="text-[11px] uppercase tracking-[0.2em] text-muted">
                  Taiyo Tuition · Portal v1
                </span>
              </div>
              <h1 className="text-[44px] sm:text-[56px] lg:text-[76px] leading-[1.02] tracking-[-0.02em] text-ink font-light">
                The quiet, organised
                <br />
                centre of <span className="font-display italic">your tutoring</span>.
              </h1>
              <p className="mt-8 max-w-xl text-base lg:text-lg text-ink-soft leading-relaxed">
                One place for students to learn, parents to follow along, tutors to
                teach, and admins to run the business. Designed to remove noise — not
                add to it.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link href="/login">
                  <Button size="lg">Sign in to the portal</Button>
                </Link>
                <Link href="https://taiyotuition.com" target="_blank">
                  <Button variant="outline" size="lg">
                    Visit taiyotuition.com
                  </Button>
                </Link>
              </div>
            </div>

            <div
              className="lg:col-span-5 rise flex justify-end"
              style={{ animationDelay: "120ms" }}
            >
              <div className="relative">
                <div className="absolute -inset-8 brand-field rounded-[40px] opacity-60 blur-2xl" />
                <LogoCard className="relative" size={280} />
                <div className="mt-6 text-right text-[10px] uppercase tracking-[0.22em] text-muted">
                  太陽 · taiyo · sun
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-hairline">
          <div className="mx-auto max-w-7xl px-6 lg:px-10 py-16 lg:py-20">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 border border-hairline rounded-2xl overflow-hidden bg-surface">
              {ROLES.map((r, i) => (
                <Link
                  key={r.role}
                  href={r.href}
                  className={`group p-8 hover:bg-surface-2 transition-colors ${
                    i > 0 ? "border-t sm:border-t-0 sm:border-l border-hairline" : ""
                  } ${i >= 2 ? "lg:border-t-0" : ""}`}
                >
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted">
                    For {r.role.toLowerCase()}s
                  </div>
                  <div className="mt-4 text-2xl font-light text-ink">{r.role}</div>
                  <div className="mt-2 text-sm text-ink-soft">{r.line}</div>
                  <div className="mt-8 text-xs text-brand-600 group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                    Enter →
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-8 flex items-center justify-between text-xs text-muted">
          <span>© Taiyo Tuition · Mount Waverley, VIC</span>
          <span className="font-display italic">太陽</span>
        </div>
      </footer>
    </div>
  );
}
