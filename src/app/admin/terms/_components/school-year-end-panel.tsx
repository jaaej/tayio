"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GraduationCap, MoveUp } from "lucide-react";
import { Button, GlassPanel } from "@/components/admin/ui";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  archiveYear12Students,
  moveStudentsUpAYear,
  type SchoolYearResult,
} from "@/app/admin/_lib/actions-school-year";

type Person = { id: string; name: string };

export type SchoolYearEndProps = {
  year: number;
  termNumber: number;
  /** "Sunday 22 November", formatted on the server. */
  termEndLabel: string;
  termEnded: boolean;
  /** Set once every student has moved up. */
  done: { onLabel: string; moved: number } | null;
  year12: Person[];
  year12Parents: { archive: Person[]; keptForInvoices: Person[] };
  moves: { from: string; to: string; count: number }[];
  finishing: Person[];
  finishingParents: { archive: Person[]; keptForInvoices: Person[] };
  unknown: (Person & { yearLevel: string | null })[];
};

function count(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function parentNote(parents: SchoolYearEndProps["year12Parents"]): string | undefined {
  const parts = [
    parents.archive.length > 0
      ? `${count(parents.archive.length, "parent")} with no other active child ${parents.archive.length === 1 ? "is" : "are"} archived too.`
      : null,
    parents.keptForInvoices.length > 0
      ? `${count(parents.keptForInvoices.length, "parent")} with an invoice still to pay ${parents.keptForInvoices.length === 1 ? "keeps their" : "keep their"} login.`
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

function resultMessage(result: Extract<SchoolYearResult, { ok: true }>) {
  const parts = [
    result.moved > 0 ? `Moved ${count(result.moved, "student")} up a year.` : null,
    result.archived > 0 ? `Archived ${count(result.archived, "Year 12 student")}.` : null,
    result.parents > 0 ? `Archived ${count(result.parents, "parent")}.` : null,
  ].filter(Boolean);
  return parts.join(" ") || "Nothing to change.";
}

const ROW = "flex flex-col gap-3 p-[18px] sm:flex-row sm:items-start sm:justify-between";

/**
 * End of school year on the Terms page, from the start of the final term:
 * archive the Year 12s, then, once the term has ended, move every other
 * student up a year (once per school year).
 */
export function SchoolYearEndPanel(props: SchoolYearEndProps) {
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [banFailed, setBanFailed] = useState<string[]>([]);

  function run(action: () => Promise<SchoolYearResult>) {
    setError(null);
    setMessage(null);
    start(async () => {
      const result = await action().catch(() => null);
      if (!result) {
        setError("Something went wrong. Reload the page to see what changed, then try again.");
        return;
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(resultMessage(result));
      setBanFailed(result.banFailed);
      router.refresh();
    });
  }

  async function onArchive() {
    const ok = await confirm({
      title: `Archive ${count(props.year12.length, "Year 12 student")}?`,
      body: "They can no longer sign in and leave all their classes; make-ups they booked after today are cancelled. Their attendance, notes, homework and invoices are kept, and each can be restored from their profile.",
      items: props.year12.map((s) => s.name),
      note: parentNote(props.year12Parents),
      confirmLabel: "Archive students",
      danger: true,
    });
    if (ok) run(() => archiveYear12Students({ schoolYear: props.year }));
  }

  async function onMoveUp() {
    const moving = props.moves.reduce((n, m) => n + m.count, 0);
    const ok = await confirm({
      title: `Move ${count(moving, "student")} up a year?`,
      items: [
        ...props.moves.map((m) => `${m.from} → ${m.to}: ${count(m.count, "student")}`),
        ...(props.finishing.length > 0
          ? [`Year 12: ${count(props.finishing.length, "student")} archived, finished school`]
          : []),
      ],
      note: [
        props.unknown.length > 0
          ? `${count(props.unknown.length, "student")} with no school year set ${props.unknown.length === 1 ? "stays" : "stay"} as ${props.unknown.length === 1 ? "is" : "they are"}.`
          : null,
        parentNote(props.finishingParents) ?? null,
      ]
        .filter(Boolean)
        .join(" ") || undefined,
      warning: `This happens once for ${props.year}.`,
      confirmLabel: "Move students up",
    });
    if (ok) run(() => moveStudentsUpAYear({ schoolYear: props.year }));
  }

  const moving = props.moves.reduce((n, m) => n + m.count, 0);

  return (
    <GlassPanel id="school-year" title={`End of ${props.year} school year`} titleId="school-year-heading">
      <div className="panel divide-y divide-line overflow-hidden p-0">
        {props.done ? (
          <p className="p-[18px] text-[14px] text-ink">
            {count(props.done.moved, "student")} moved up a year on {props.done.onLabel}.
          </p>
        ) : (
          <>
            <div className={ROW}>
              <div className="flex min-w-0 gap-3">
                <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-brand-50 text-brand-700">
                  <GraduationCap className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[14px] font-extrabold text-ink">Archive Year 12 students</h3>
                  <p className="mt-0.5 text-[13px] text-ink-soft">
                    {props.year12.length > 0 ? count(props.year12.length, "student") + " in Year 12" : "No students in Year 12."}
                  </p>
                </div>
              </div>
              {props.year12.length > 0 && (
                <Button type="button" variant="outline" size="lg" disabled={pending} onClick={onArchive}>
                  Archive {count(props.year12.length, "student")}
                </Button>
              )}
            </div>

            <div className={ROW}>
              <div className="flex min-w-0 gap-3">
                <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-brand-50 text-brand-700">
                  <MoveUp className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[14px] font-extrabold text-ink">Move every student up a year</h3>
                  <p className="mt-0.5 text-[13px] text-ink-soft">
                    {props.termEnded
                      ? count(moving, "student") + (props.finishing.length > 0 ? `, and ${count(props.finishing.length, "Year 12")} archived` : "")
                      : `Opens when Term ${props.termNumber} ends on ${props.termEndLabel}.`}
                  </p>
                  {props.termEnded && props.unknown.length > 0 && (
                    <p className="mt-2 text-[13px] text-ink-soft">
                      No school year set, so they stay as they are:{" "}
                      {props.unknown.map((s, i) => (
                        <span key={s.id}>
                          {i > 0 && ", "}
                          <Link href={`/admin/users/${s.id}`} className="font-bold text-ink underline-offset-2 hover:underline">
                            {s.name}
                          </Link>
                          {s.yearLevel ? ` (${s.yearLevel})` : ""}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="primary"
                size="lg"
                disabled={pending || !props.termEnded || (moving === 0 && props.finishing.length === 0)}
                onClick={onMoveUp}
              >
                Move up a year
              </Button>
            </div>
          </>
        )}

        {((message && !props.done) || error || banFailed.length > 0) && (
          <div className="flex flex-col gap-1.5 p-[18px]" aria-live="polite">
            {/* Once moved up, the panel's own line says so. */}
            {message && !props.done && <p className="text-[13px] font-semibold text-good">{message}</p>}
            {banFailed.length > 0 && (
              <p role="alert" className="text-[13px] font-semibold text-bad">
                Sign-in could not be blocked for {banFailed.join(", ")}. Open each profile and deactivate it again.
              </p>
            )}
            {error && (
              <p role="alert" className="text-[13px] font-semibold text-bad">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
      {confirmDialog}
    </GlassPanel>
  );
}
