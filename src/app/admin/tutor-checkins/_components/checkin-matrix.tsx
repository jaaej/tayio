"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button, Empty, GlassPanel, Pill, SidePanel } from "@/components/admin/ui";
import type { PillTone } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import type { CellStatus, MatrixRow, RowStatus } from "../_lib/matrix";
import { CheckinEntryEditor } from "./entry-editor";

export type MatrixDay = { date: string; label: string; longLabel: string; isToday: boolean };

/** One payroll row, with its display strings prepared on the server. */
export type PanelEntry = {
  id: string;
  label: string;
  when: string;
  hours: string;
  payLine: string;
  note: string | null;
  isRemoved: boolean;
  isManualOverride: boolean;
  editor: {
    id: string;
    subjectName: string;
    className: string;
    workDate: string;
    startTime: string;
    endTime: string;
    hourlyRate: string;
    note: string | null;
    isRemoved: boolean;
    updatedAt: string;
  };
};

export type MatrixTutor = {
  tutorId: string;
  name: string;
  rateLabel: string | null;
  totalHours: string;
  totalPay: string;
  matrix: MatrixRow;
  cellHours: string[];
  disputeMessage: string | null;
  entries: PanelEntry[];
};

const CELL_TONE: Record<CellStatus, string> = {
  approved: "bg-good-bg text-good",
  waiting: "bg-warn-bg text-warn",
  issue: "bg-bad-bg text-bad",
  corrected: "bg-info-bg text-info",
  removed: "bg-surface-3 text-muted",
};

const CELL_LABEL: Record<CellStatus, string> = {
  approved: "Approved",
  waiting: "Waiting on tutor",
  issue: "Issue reported",
  corrected: "Admin corrected",
  removed: "Removed from pay",
};

const ROW_PILL: Record<RowStatus, { tone: PillTone; label: string }> = {
  approved: { tone: "good", label: "Approved" },
  waiting: { tone: "warn", label: "Waiting on tutor" },
  issue: { tone: "bad", label: "Issue reported" },
  none: { tone: "default", label: "No work" },
};

type OpenPanel = {
  tutorId: string;
  title: string;
  entryIds: string[];
  showDispute: boolean;
};

function lessonCountLabel(count: number) {
  return count === 1 ? "1 lesson" : `${count} lessons`;
}

export function CheckinMatrix({
  tutors,
  days,
  weekLabel,
  filters,
}: {
  tutors: MatrixTutor[];
  days: MatrixDay[];
  weekLabel: string;
  filters: ReactNode;
}) {
  // The last panel stays in state while it slides out, so its content does
  // not vanish mid-transition; `isOpen` drives visibility.
  const [open, setPanel] = useState<OpenPanel | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);
  const setOpen = (panel: OpenPanel) => {
    setPanel(panel);
    setIsOpen(true);
  };

  // Look rows up by id in the latest server props, so a correction that moves
  // a row to another day keeps it in view with its refreshed values.
  const panelTutor = open
    ? tutors.find((tutor) => tutor.tutorId === open.tutorId) ?? null
    : null;
  const panelEntries = useMemo(() => {
    if (!open || !panelTutor) return [];
    const ids = new Set(open.entryIds);
    return panelTutor.entries.filter((entry) => ids.has(entry.id));
  }, [open, panelTutor]);

  const issues = tutors.filter((tutor) => tutor.matrix.status === "issue");

  function reviewWeek(tutor: MatrixTutor) {
    setOpen({
      tutorId: tutor.tutorId,
      title: `${tutor.name} - ${weekLabel}`,
      entryIds: tutor.matrix.entryIds,
      showDispute: true,
    });
  }

  return (
    <>
      {issues.length > 0 && (
        <GlassPanel
          title={
            <span className="flex items-center gap-2.5">
              <span className="h-[9px] w-[9px] rounded-full bg-bad" aria-hidden />
              Needs your decision
            </span>
          }
          titleId="checkin-issues-h"
        >
          <ul className="divide-y divide-line">
            {issues.map((tutor) => (
              <li
                key={tutor.tutorId}
                className="flex flex-wrap items-center gap-3.5 px-4 py-3.5"
              >
                <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
                  <span className="text-[14px] font-extrabold text-ink">
                    {tutor.name} · {weekLabel}
                  </span>
                  {tutor.disputeMessage && (
                    <span className="text-[13px] text-ink-soft">
                      &ldquo;{tutor.disputeMessage}&rdquo;
                    </span>
                  )}
                </div>
                <Button onClick={() => reviewWeek(tutor)}>Review lessons</Button>
              </li>
            ))}
          </ul>
        </GlassPanel>
      )}

      <GlassPanel title="Hours by day" titleId="checkin-matrix-h" action={filters}>
        {tutors.length === 0 ? (
          <Empty>No active tutors match these filters.</Empty>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] table-fixed border-collapse text-[13px]">
                <thead>
                  <tr className="text-[12px] text-muted">
                    <th
                      scope="col"
                      className="sticky left-0 z-10 w-[170px] bg-surface px-4 py-3 text-left font-extrabold"
                    >
                      Tutor
                    </th>
                    {days.map((day) => (
                      <th key={day.date} scope="col" className="px-1.5 py-3 text-center font-extrabold">
                        <span
                          aria-current={day.isToday ? "date" : undefined}
                          className={cn(
                            "inline-flex h-6 items-center rounded-full px-2 tabular-nums",
                            day.isToday && "bg-ink text-white",
                          )}
                        >
                          {day.label}
                        </span>
                      </th>
                    ))}
                    <th scope="col" className="w-[120px] px-2.5 py-3 text-right font-extrabold">
                      Week total
                    </th>
                    <th scope="col" className="w-[190px] px-4 py-3 text-right font-extrabold">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tutors.map((tutor) => {
                    const pill = ROW_PILL[tutor.matrix.status];
                    return (
                      <tr key={tutor.tutorId} className="border-t border-line">
                        <th
                          scope="row"
                          className="sticky left-0 z-10 bg-surface px-4 py-2.5 text-left align-middle"
                        >
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-[14px] font-extrabold text-ink">
                              {tutor.name}
                            </span>
                            {tutor.matrix.hasMissingRate ? (
                              <Link
                                href={`/admin/users/${tutor.tutorId}?tab=tutor`}
                                className="text-[12px] font-bold text-bad underline underline-offset-2"
                              >
                                Rate missing
                              </Link>
                            ) : (
                              tutor.rateLabel && (
                                <span className="text-[12px] font-semibold text-muted tabular-nums">
                                  {tutor.rateLabel}
                                </span>
                              )
                            )}
                          </span>
                        </th>
                        {tutor.matrix.cells.map((cell, index) => {
                          const day = days[index];
                          if (!cell.status) {
                            return (
                              <td key={cell.date} className="px-1 py-1.5 text-center">
                                <span className="font-bold text-line-strong" aria-label="No lessons">
                                  -
                                </span>
                              </td>
                            );
                          }
                          const status = cell.status;
                          const detail =
                            status === "removed" ? "Removed" : lessonCountLabel(cell.lessonCount);
                          return (
                            <td key={cell.date} className="px-1 py-1.5 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpen({
                                    tutorId: tutor.tutorId,
                                    title: `${tutor.name} - ${day.longLabel}`,
                                    entryIds: cell.entryIds,
                                    showDispute: false,
                                  })
                                }
                                aria-label={`${tutor.name}, ${day.longLabel}: ${tutor.cellHours[index]}, ${detail}, ${CELL_LABEL[status]}`}
                                className={cn(
                                  "flex h-11 w-full flex-col items-center justify-center gap-px rounded-[10px] transition-[outline-color] duration-150 hover:outline hover:outline-2 hover:-outline-offset-2 hover:outline-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                                  CELL_TONE[status],
                                )}
                              >
                                <span className="text-[13px] font-extrabold tabular-nums">
                                  {tutor.cellHours[index]}
                                </span>
                                <span className="text-[10px] font-bold opacity-80">{detail}</span>
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-2.5 py-2.5 text-right tabular-nums">
                          <span className="flex flex-col">
                            <span className="text-[14px] font-extrabold text-ink">{tutor.totalHours}</span>
                            <span className="text-[12px] text-muted">{tutor.totalPay}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="inline-flex items-center gap-2">
                            <Pill tone={pill.tone}>{pill.label}</Pill>
                            {tutor.matrix.status === "issue" && (
                              <Button size="sm" onClick={() => reviewWeek(tutor)}>
                                Review
                              </Button>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul
              aria-label="Cell colours"
              className="flex flex-wrap gap-x-4 gap-y-2 border-t border-line bg-surface-2 px-4 py-3 text-[12px] font-semibold text-ink-soft"
            >
              {(Object.keys(CELL_LABEL) as CellStatus[]).map((status) => (
                <li key={status} className="flex items-center gap-1.5">
                  <span className={cn("h-3 w-3 rounded-[4px]", CELL_TONE[status])} aria-hidden />
                  {CELL_LABEL[status]}
                </li>
              ))}
            </ul>
          </>
        )}
      </GlassPanel>

      <SidePanel open={isOpen} onClose={close} title={open?.title ?? ""}>
        {panelTutor && open && (
          <div className="space-y-3">
            {open.showDispute && panelTutor.disputeMessage && (
              <p className="rounded-[12px] bg-bad-bg px-3.5 py-3 text-[13px] text-bad">
                <strong>Tutor note:</strong> {panelTutor.disputeMessage}
              </p>
            )}
            {panelTutor.matrix.hasMissingRate && (
              <p className="rounded-[12px] bg-warn-bg px-3.5 py-3 text-[12px] font-semibold text-warn">
                An hourly rate is missing. Set it on{" "}
                <Link
                  href={`/admin/users/${panelTutor.tutorId}?tab=tutor`}
                  className="underline underline-offset-2"
                >
                  {panelTutor.name}&apos;s user record
                </Link>
                , then review this pending week.
              </p>
            )}
            {panelEntries.length === 0 ? (
              <Empty>No payroll rows here.</Empty>
            ) : (
              <ul className="space-y-3">
                {panelEntries.map((entry) => (
                  <li
                    key={entry.id}
                    className={cn(
                      "rounded-[14px] border border-line p-3.5",
                      entry.isRemoved && "bg-surface-2",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div
                          className={cn(
                            "text-[14px] font-extrabold text-ink",
                            entry.isRemoved && "line-through opacity-70",
                          )}
                        >
                          {entry.label}
                        </div>
                        <div className="mt-0.5 text-[12px] text-muted">{entry.when}</div>
                      </div>
                      <div className="text-right tabular-nums">
                        <div className="text-[14px] font-extrabold text-ink">{entry.hours}</div>
                        <div className="mt-0.5 text-[12px] text-muted">{entry.payLine}</div>
                      </div>
                    </div>
                    {(entry.isManualOverride || entry.isRemoved || entry.note) && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {entry.isManualOverride && <Pill tone="info">Admin corrected</Pill>}
                        {entry.isRemoved && <Pill tone="bad">Removed</Pill>}
                        {entry.note && (
                          <span className="text-[12px] text-ink-soft">{entry.note}</span>
                        )}
                      </div>
                    )}
                    <CheckinEntryEditor
                      entry={entry.editor}
                      defaultOpen={panelEntries.length === 1}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </SidePanel>
    </>
  );
}
