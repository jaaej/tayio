"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Plus, X } from "lucide-react";
import { Button, GlassPanel, PageHeader, buttonVariants } from "@/components/admin/ui";
import {
  deleteSubject,
  getSubjectDeletionImpact,
  saveSubjectPage,
} from "@/app/admin/_lib/actions-subjects";
import { subjectDeletionItems } from "@/app/admin/_lib/deletion-copy";
import { richText } from "@/app/admin/_components/rich-text";
import { DeleteClassButton } from "@/app/admin/classes/_components/delete-class-button";
import { SelectField } from "@/app/admin/classes/_components/class-fields";
import { ColourSwatches, LevelSelect } from "@/app/admin/classes/_components/subject-fields";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { subjectTone, type SubjectColor } from "@/lib/subject-tone";
import { cn } from "@/lib/utils";
import { changeNotice, roomTaken, type CardSlot } from "../_lib/class-card";

export type EditClass = {
  id: string;
  title: string;
  /** "6 students · 14 lessons run" or "6 students · starts 24 Oct". */
  meta: string;
  enrolled: number;
  /** Linked parents of the enrolled students, each counted once. */
  parents: number;
  saved: CardSlot;
};

type Card = {
  key: string;
  id?: string;
  title: string;
  meta: string;
  enrolled: number;
  parents: number;
  /** Null for a class added on this page and not saved yet. */
  saved: CardSlot | null;
  current: CardSlot;
};

type OtherSlot = {
  classId: string;
  weekday: number | null;
  startTime: string | null;
  endTime: string | null;
  room: string | null;
};

const LBL = "text-[12px] font-bold text-[#5E5A73]";
const INPUT =
  "h-10 w-full min-w-0 rounded-[11px] border border-[#DCDEE9] bg-white px-2.5 text-[14px] text-ink transition-colors focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10 disabled:opacity-60";
const SELECT = "h-10 rounded-[11px] border-[#DCDEE9] px-2.5 text-[14px]";

/** Monday first, as the schedule reads; values are JS weekdays (Sun = 0). */
const DAYS = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
  [0, "Sunday"],
] as const;

const EMPTY_SLOT: CardSlot = { weekday: null, startTime: "", endTime: "", room: "", tutorId: "" };

function dirty(card: Card) {
  if (!card.saved) return true;
  const a = card.saved;
  const b = card.current;
  return (
    a.weekday !== b.weekday ||
    a.startTime !== b.startTime ||
    a.endTime !== b.endTime ||
    a.room.trim() !== b.room.trim() ||
    a.tutorId !== b.tutorId
  );
}

export function SubjectEditForm({
  subject,
  sub,
  classes,
  tutors,
  rooms,
  otherSlots,
}: {
  subject: { id: string; name: string; yearLevel: string; color: SubjectColor };
  sub: string;
  classes: EditClass[];
  tutors: { id: string; name: string }[];
  /** Room chips: rooms any class uses, then "Online". */
  rooms: string[];
  /** Every weekly class's saved slot and room, for "Taken at this time". */
  otherSlots: OtherSlot[];
}) {
  const router = useRouter();
  const formId = useId();
  const [pending, start] = useTransition();
  const [name, setName] = useState(subject.name);
  const [level, setLevel] = useState(subject.yearLevel);
  const [color, setColor] = useState<SubjectColor>(subject.color);
  const [cards, setCards] = useState<Card[]>(() =>
    classes.map((c) => ({ key: c.id, ...c, current: c.saved })),
  );
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [classErrors, setClassErrors] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState(false);
  const { confirm, confirmDialog } = useConfirm();

  const tutorName = (id: string) => tutors.find((t) => t.id === id)?.name ?? "the tutor";
  const dot = subjectTone(subject.name, color).dot;

  function update(key: string, patch: Partial<CardSlot>) {
    setCards((cs) => cs.map((c) => (c.key === key ? { ...c, current: { ...c.current, ...patch } } : c)));
    setClassErrors(({ [key]: _gone, ...rest }) => rest);
  }

  function addClass() {
    const key = `new-${crypto.randomUUID()}`;
    setCards((cs) => [
      ...cs,
      {
        key,
        title: "New class",
        meta: "Not saved yet",
        enrolled: 0,
        parents: 0,
        saved: null,
        current: { ...EMPTY_SLOT, tutorId: tutors.length === 1 ? tutors[0].id : "" },
      },
    ]);
  }

  function save() {
    setError(null);
    setNameError(null);
    // Checked here so each card says what is missing; the server checks too.
    const errors: Record<string, string> = {};
    for (const c of cards) {
      if (!c.current.tutorId) errors[c.key] = "Choose a tutor.";
      else if (c.current.weekday !== null && (!c.current.startTime || !c.current.endTime)) {
        errors[c.key] = "Choose a start and end time.";
      }
    }
    setClassErrors(errors);
    if (!name.trim()) setNameError("Enter a subject name.");
    if (Object.keys(errors).length > 0 || !name.trim()) return;

    start(async () => {
      try {
        const result = await saveSubjectPage({
          id: subject.id,
          name: name.trim(),
          yearLevel: level || undefined,
          color,
          classes: cards.filter(dirty).map((c) => ({
            key: c.key,
            id: c.id,
            weekday: c.current.weekday,
            startTime: c.current.startTime,
            endTime: c.current.endTime,
            tutorId: c.current.tutorId,
            location: c.current.room,
          })),
        });
        if (!result.ok) {
          setError(result.error ?? null);
          setNameError(result.nameError ?? null);
          setClassErrors(result.classErrors ?? {});
          return;
        }
        router.push("/admin/classes");
      } catch {
        setError("Could not save. Try again.");
      }
    });
  }

  async function onDeleteSubject() {
    setError(null);
    setDeleting(true);
    const checked = await getSubjectDeletionImpact(subject.id).catch(() => null);
    setDeleting(false);
    if (!checked) {
      setError("Could not check this subject. Try again.");
      return;
    }
    const items = subjectDeletionItems(checked.impact);
    const ok = await confirm({
      icon: "delete",
      title: `Delete ${subject.name}?`,
      body: checked.impact.hasHistory
        ? "Its classes have already run, so this permanently removes:"
        : items.length > 0
          ? "This permanently removes:"
          : "Nothing has been added to this subject yet.",
      items: items.map(richText),
      note: "Invoices already issued are kept.",
      warning: "This can’t be undone, and the data can’t be recovered.",
      confirmText: subject.name,
      confirmLabel: "Delete subject",
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    const result = await deleteSubject({ id: subject.id, confirmName: subject.name }).catch(() => null);
    if (!result?.ok) {
      setDeleting(false);
      setError(result?.error ?? "Could not delete the subject. Try again.");
      return;
    }
    router.push("/admin/classes");
  }

  return (
    <form
      id={formId}
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <PageHeader
        back={{ href: "/admin/classes", label: "Back to Classes" }}
        title={
          <span className="flex items-center gap-2.5">
            <span aria-hidden className="h-3 w-3 shrink-0 rounded-[4px]" style={{ backgroundColor: dot }} />
            Edit {subject.name}
          </span>
        }
        sub={sub}
        actions={
          <>
            <Link href="/admin/classes" className={buttonVariants({ variant: "glass", size: "lg" })}>
              Cancel
            </Link>
            <Button type="submit" size="lg" variant="primary" disabled={pending || deleting} className="px-[18px]">
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </>
        }
      />

      {error && (
        <p role="alert" className="rounded-[14px] bg-bad-bg px-4 py-3 text-[14px] font-semibold text-bad">
          {error}
        </p>
      )}

      <fieldset disabled={pending} className="contents">
        <GlassPanel
          title="Subject"
          titleId={`${formId}-subject`}
          action={
            <Link
              href={`/admin/subjects/${subject.id}/curriculum`}
              className="px-1.5 text-[13px] font-bold text-[#3A1AA8] hover:text-[#21106B]"
            >
              Open curriculum
            </Link>
          }
          bodyClassName="grid items-start gap-5 p-[18px] lg:[grid-template-columns:minmax(0,1.3fr)_minmax(0,0.7fr)_minmax(0,1.4fr)]"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${formId}-name`} className={LBL}>
              Name
            </label>
            <input
              id={`${formId}-name`}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(null);
              }}
              required
              maxLength={200}
              autoComplete="off"
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? `${formId}-name-error` : undefined}
              className={cn(
                INPUT,
                "h-[42px] px-3 text-[15px] font-bold",
                nameError && "border-bad focus:border-bad",
              )}
            />
            {nameError && (
              <p id={`${formId}-name-error`} role="alert" className="text-[13px] font-semibold text-bad">
                {nameError}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${formId}-level`} className={LBL}>
              Level
            </label>
            <LevelSelect
              id={`${formId}-level`}
              value={level}
              onChange={setLevel}
              className="h-[42px] rounded-[11px] border-[#DCDEE9] px-2.5 text-[14px]"
            />
          </div>
          <div className="flex flex-col gap-2">
            <span id={`${formId}-colour`} className={LBL}>
              Colour
            </span>
            <div className="pt-1">
              <ColourSwatches value={color} onChange={setColor} labelledBy={`${formId}-colour`} />
            </div>
          </div>
        </GlassPanel>

        <GlassPanel
          title="Classes"
          titleId={`${formId}-classes`}
          meta={cards.length}
          action={
            <Button type="button" variant="glass" onClick={addClass}>
              <Plus className="h-[14px] w-[14px]" strokeWidth={2.4} aria-hidden />
              Add class
            </Button>
          }
          bodyClassName="flex flex-col gap-1.5 overflow-visible rounded-none bg-transparent shadow-none"
        >
          {cards.length === 0 && (
            <p className="panel px-5 py-6 text-center text-[14px] text-ink-soft">
              No classes yet.
            </p>
          )}
          {cards.map((card) => {
            const others = [
              ...otherSlots.filter((o) => !cards.some((c) => c.id === o.classId)),
              ...cards.filter((c) => c.key !== card.key).map((c) => c.current),
            ];
            const notice = card.saved
              ? changeNotice(card.saved, card.current, {
                  tutorName: tutorName(card.current.tutorId),
                  oldTutorName: tutorName(card.saved.tutorId),
                  students: card.enrolled,
                  parents: card.parents,
                })
              : null;
            const roomChanged = card.saved && card.saved.room.trim() !== card.current.room.trim();
            const ids = {
              day: `${formId}-${card.key}-day`,
              start: `${formId}-${card.key}-start`,
              end: `${formId}-${card.key}-end`,
              tutor: `${formId}-${card.key}-tutor`,
              room: `${formId}-${card.key}-room`,
            };
            return (
              <div key={card.key} className="panel flex flex-col gap-3.5 px-[18px] py-4">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                    <span className="text-[15px] font-extrabold text-ink">{card.title}</span>
                    <span className="text-[12px] font-semibold text-[#5E5A73]">{card.meta}</span>
                  </span>
                  {card.id ? (
                    <DeleteClassButton
                      id={card.id}
                      variant="inline"
                      onDeleted={() => {
                        setCards((cs) => cs.filter((c) => c.key !== card.key));
                        router.refresh();
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCards((cs) => cs.filter((c) => c.key !== card.key))}
                      className="flex h-[34px] items-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-bold text-ink-soft transition-colors hover:bg-[#F1F2F7] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                    >
                      <X className="h-[15px] w-[15px]" strokeWidth={2} aria-hidden />
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 items-start gap-3.5 lg:[grid-template-columns:150px_136px_136px_minmax(0,1fr)_minmax(0,1.3fr)]">
                  <div className="col-span-2 flex flex-col gap-1.5 lg:col-span-1">
                    <label htmlFor={ids.day} className={LBL}>
                      Day
                    </label>
                    <SelectField
                      id={ids.day}
                      value={card.current.weekday === null ? "" : String(card.current.weekday)}
                      onChange={(e) =>
                        update(card.key, {
                          weekday: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      className={SELECT}
                    >
                      <option value="">No weekly day</option>
                      {DAYS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={ids.start} className={LBL}>
                      Starts
                    </label>
                    <input
                      id={ids.start}
                      type="time"
                      value={card.current.startTime}
                      onChange={(e) => update(card.key, { startTime: e.target.value })}
                      className={INPUT}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={ids.end} className={LBL}>
                      Ends
                    </label>
                    <input
                      id={ids.end}
                      type="time"
                      value={card.current.endTime}
                      onChange={(e) => update(card.key, { endTime: e.target.value })}
                      className={INPUT}
                    />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5 lg:col-span-1">
                    <label htmlFor={ids.tutor} className={LBL}>
                      Tutor
                    </label>
                    <SelectField
                      id={ids.tutor}
                      value={card.current.tutorId}
                      onChange={(e) => update(card.key, { tutorId: e.target.value })}
                      className={SELECT}
                    >
                      {!card.current.tutorId && (
                        <option value="" disabled>
                          Choose tutor
                        </option>
                      )}
                      {tutors.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5 lg:col-span-1">
                    <label htmlFor={ids.room} className={LBL}>
                      Room
                    </label>
                    <input
                      id={ids.room}
                      value={card.current.room}
                      onChange={(e) => update(card.key, { room: e.target.value })}
                      placeholder="Type a room"
                      maxLength={200}
                      autoComplete="off"
                      className={cn(INPUT, roomChanged && "border-ink")}
                    />
                    <div className="flex flex-wrap gap-1">
                      {rooms.map((room) => {
                        const selected =
                          card.current.room.trim().toLowerCase() === room.toLowerCase();
                        const taken = !selected && roomTaken(room, card.current, others);
                        return (
                          <button
                            key={room}
                            type="button"
                            onClick={() => update(card.key, { room })}
                            aria-pressed={selected}
                            aria-label={taken ? `${room}, taken at this time` : room}
                            title={taken ? "Taken at this time" : selected ? "Selected" : "Free at this time"}
                            className={cn(
                              "h-[26px] rounded-[13px] border px-[9px] text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                              selected
                                ? "border-ink bg-ink text-white"
                                : taken
                                  ? "border-[#DCDEE9] bg-white text-[#9A9AAD] line-through"
                                  : "border-[#DCDEE9] bg-white text-ink hover:bg-[#F6F7FA]",
                            )}
                          >
                            {room}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {classErrors[card.key] && (
                  <p role="alert" className="text-[13px] font-semibold text-bad">
                    {classErrors[card.key]}
                  </p>
                )}
                {notice && (
                  <p
                    aria-live="polite"
                    className="flex items-center gap-2 rounded-[12px] bg-[#E7EFFD] px-3 py-2.5 text-[13px] font-semibold text-[#1E4FB8]"
                  >
                    <Bell className="h-[15px] w-[15px] shrink-0" strokeWidth={1.9} aria-hidden />
                    {notice}
                  </p>
                )}
              </div>
            );
          })}
        </GlassPanel>
      </fieldset>

      <section aria-labelledby={`${formId}-danger`} className="glass rounded-[24px] p-1.5">
        <div className="panel flex flex-wrap items-center justify-between gap-3 px-[18px] py-4">
          <span className="flex flex-col gap-0.5">
            <h2 id={`${formId}-danger`} className="text-[15px] font-extrabold text-ink">
              Delete this subject
            </h2>
            <span className="text-[13px] text-[#5E5A73]">
              Removes its classes, lessons, curriculum, homework and marks.
            </span>
          </span>
          <button
            type="button"
            onClick={onDeleteSubject}
            disabled={deleting || pending}
            className="flex h-10 items-center rounded-[11px] border border-[#F4C7C3] bg-white px-4 text-[14px] font-bold text-[#B42318] transition-colors hover:bg-[#FDF3F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60"
          >
            {deleting ? "Working…" : "Delete subject"}
          </button>
        </div>
      </section>
      {confirmDialog}
    </form>
  );
}
