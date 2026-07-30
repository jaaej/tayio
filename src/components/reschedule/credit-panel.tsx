"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatDateLong, formatTime } from "@/lib/format";
import { loadCreditRedemption, redeemCredit } from "@/app/_actions/credits";
import type { RescheduleSlot } from "@/app/_actions/reschedule";

export type PanelCredit = {
  id: string;
  subjectName: string;
  expiresAt: string;
  grantReason: "cancellation" | "reschedule_no_slot";
};

type OpenState = {
  creditId: string;
  slots: RescheduleSlot[];
  picked: RescheduleSlot | null;
};

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1";

/**
 * Shared class-credit panel used by the student and parent portals. Lists a
 * holder's active (redeemable) credits; each has a single primary "Use
 * credit" action that loads the origin tutor's open slots and lets the
 * holder book one, submitting `redeemCredit`.
 */
export function CreditPanel({
  credits,
  studentId,
  adminId,
}: {
  credits: PanelCredit[];
  /** Passed by the parent portal to act on behalf of a linked child. Omitted
   *  on the student's own timetable - the action defaults to the caller. */
  studentId?: string;
  /** Admin office profile id to message when no redemption slot is
   *  available. Null if no admin contact is available (empty state falls
   *  back to plain text with no link). */
  adminId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<OpenState | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<{ creditId: string; text: string } | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, startLoad] = useTransition();
  const [submitting, startSubmit] = useTransition();

  const slotsByDate = useMemo(() => {
    const m = new Map<string, RescheduleSlot[]>();
    if (open) {
      for (const s of open.slots) (m.get(s.date) ?? m.set(s.date, []).get(s.date)!).push(s);
      for (const list of m.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [open]);

  if (credits.length === 0) return null;

  function openCredit(creditId: string) {
    setFlash(null);
    setError(null);
    setPendingId(creditId);
    startLoad(async () => {
      const res = await loadCreditRedemption(creditId, studentId);
      if (!res.ok) {
        setError({ creditId, text: res.error });
        setPendingId(null);
        return;
      }
      setOpen({ creditId, slots: res.slots, picked: null });
      setPendingId(null);
    });
  }

  function closeCredit() {
    setOpen(null);
    setError(null);
  }

  function confirmRedeem() {
    if (!open?.picked) return;
    const s = open.picked;
    const fd = new FormData();
    fd.set("creditId", open.creditId);
    if (studentId) fd.set("studentId", studentId);
    fd.set("slot", `${s.tutorId}|${s.date}|${s.startTime}|${s.endTime}`);
    startSubmit(async () => {
      const res = await redeemCredit(fd);
      setOpen(null);
      setFlash(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {flash && (
        <div
          className={cn(
            "rounded-[12px] border px-4 py-2.5 text-[13px] font-bold",
            flash.ok
              ? "border-good/40 bg-good-bg text-good"
              : "border-bad/40 bg-bad-bg text-bad",
          )}
        >
          {flash.text}
        </div>
      )}

      <div className="rounded-[14px] border border-line bg-surface">
        <div className="border-b border-line px-4 py-3.5">
          <h3 className="m-0 text-[14px] font-bold text-ink">Class credits</h3>
        </div>
        <div className="divide-y divide-line">
          {credits.map((c) => {
            const isOpen = open?.creditId === c.id;
            return (
              <div key={c.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-bold text-ink">{c.subjectName}</div>
                    <div className="text-[12px] text-muted">
                      Expires {formatDateLong(c.expiresAt)}
                    </div>
                  </div>
                  {!isOpen && (
                    <button
                      type="button"
                      onClick={() => openCredit(c.id)}
                      disabled={loading}
                      className={cn(
                        "shrink-0 min-h-11 rounded-[10px] bg-brand-500 px-4 text-[13px] font-bold text-white transition-colors hover:bg-brand-600 disabled:opacity-50",
                        FOCUS_RING,
                      )}
                    >
                      {loading && pendingId === c.id ? "Loading…" : "Use credit"}
                    </button>
                  )}
                </div>

                {error?.creditId === c.id && (
                  <div className="mt-2 text-[13px] font-semibold text-bad">
                    {error.text}
                  </div>
                )}

                {isOpen && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[12px] font-semibold text-muted">
                        Pick a new time with your tutor.
                      </div>
                      <button
                        type="button"
                        onClick={closeCredit}
                        className={cn(
                          "text-[12px] font-bold text-muted hover:text-ink",
                          FOCUS_RING,
                        )}
                      >
                        Close
                      </button>
                    </div>

                    {open.slots.length === 0 ? (
                      <div className="rounded-[12px] border border-line bg-surface-2/60 px-4 py-3">
                        <div className="text-[13px] text-muted">
                          No open slots with your tutor right now. Please
                          contact the office.
                        </div>
                        {adminId && (
                          <Link
                            href={`/student/messages/with/${adminId}`}
                            className={cn(
                              "mt-3 inline-flex min-h-11 items-center justify-center rounded-[12px] bg-brand-500 px-5 text-[14px] font-bold text-white transition-colors hover:bg-brand-600",
                              FOCUS_RING,
                            )}
                          >
                            Message the office
                          </Link>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          {slotsByDate.map(([date, list]) => (
                            <div key={date}>
                              <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-2">
                                {formatDateLong(date)}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {list.map((s) => {
                                  const active =
                                    open.picked?.date === s.date &&
                                    open.picked?.startTime === s.startTime;
                                  return (
                                    <button
                                      key={`${s.date}-${s.startTime}`}
                                      type="button"
                                      onClick={() =>
                                        setOpen((o) => (o ? { ...o, picked: s } : o))
                                      }
                                      className={cn(
                                        "min-h-11 rounded-[10px] border px-3 text-[13px] font-bold transition-colors",
                                        active
                                          ? "border-brand-500 bg-brand-500 text-white"
                                          : "border-good/40 bg-good-bg text-good hover:brightness-95",
                                        FOCUS_RING,
                                      )}
                                    >
                                      {formatTime(s.startTime)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[13px] text-ink">
                            {open.picked ? (
                              <>
                                Book{" "}
                                <span className="font-bold">
                                  {formatDateLong(open.picked.date)}{" "}
                                  {formatTime(open.picked.startTime)}
                                </span>
                              </>
                            ) : (
                              <span className="text-muted">Select a time above.</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={confirmRedeem}
                            disabled={!open.picked || submitting}
                            className={cn(
                              "min-h-11 shrink-0 rounded-[10px] bg-brand-500 px-4 text-[13px] font-bold text-white transition-colors hover:bg-brand-600 disabled:opacity-50",
                              FOCUS_RING,
                            )}
                          >
                            {submitting ? "Booking…" : "Book credit"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
