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
import { RoomPicker } from "@/app/admin/classes/_components/room-picker";
import { ColourSwatches, LevelSelect } from "@/app/admin/classes/_components/subject-fields";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { subjectTone, type SubjectColor } from "@/lib/subject-tone";
import { DEFAULT_GROUP_CAPACITY, oneOnOneError } from "@/lib/class-capacity";
import { cn } from "@/lib/utils";
import {
  rankTutorsForSlot,
  type TutorClassSlot,
  type TutorWeeklyWindow,
} from "@/app/admin/classes/_lib/tutor-fit";
import {
  changeNotice,
  detailsPatch,
  hasStudentChanges,
  studentChanges,
  type CardDetails,
  type CardSlot,
  type CardStudent,
} from "../_lib/class-card";
import { ClassStudents } from "./class-students";

export type EditClass = {
  id: string;
  title: string;
  /** "6 students · 14 lessons run" or "6 students · starts 24 Oct". */
  meta: string;
  enrolled: number;
  /** Linked parents of the enrolled students, each counted once. */
  parents: number;
  saved: CardSlot;
  details: CardDetails;
  students: CardStudent[];
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
  savedDetails: CardDetails | null;
  details: CardDetails;
  students: CardStudent[];
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

const CLASS_TYPES = [
  ["group", "Group"],
  ["one_on_one", "One-on-one"],
] as const;

const STEP =
  "grid h-full w-9 shrink-0 place-items-center text-[17px] font-bold text-ink transition-colors hover:bg-[#F1F2F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 disabled:opacity-40";

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
    a.tutorId !== b.tutorId ||
    Object.keys(detailsPatch(card.savedDetails, card.details)).length > 0 ||
    hasStudentChanges(studentChanges(card.students))
  );
}

export function SubjectEditForm({
  subject,
  sub,
  classes,
  tutors,
  rooms,
  otherSlots,
  tutorWindows,
  classSlots,
  students,
}: {
  subject: { id: string; name: string; yearLevel: string; color: SubjectColor };
  sub: string;
  classes: EditClass[];
  tutors: { id: string; name: string; firstName: string; lastName: string }[];
  /** Room chips: rooms any class uses, then "Online". */
  rooms: string[];
  /** Every weekly class's saved slot and room, for "Taken at this time". */
  otherSlots: OtherSlot[];
  /** Tutors' weekly availability, to rank them for each card's slot. */
  tutorWindows: TutorWeeklyWindow[];
  /** Every weekly class, to spot a tutor already teaching then. */
  classSlots: (TutorClassSlot & { classId: string })[];
  /** Every student account, for each card's Add a student. */
  students: { id: string; name: string; detail: string }[];
}) {
  const router = useRouter();
  const formId = useId();
  const [pending, start] = useTransition();
  const [name, setName] = useState(subject.name);
  const [level, setLevel] = useState(subject.yearLevel);
  const [color, setColor] = useState<SubjectColor>(subject.color);
  const [cards, setCards] = useState<Card[]>(() =>
    classes.map((c) => ({ key: c.id, ...c, current: c.saved, savedDetails: c.details })),
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

  function updateDetails(key: string, patch: Partial<CardDetails>) {
    setCards((cs) => cs.map((c) => (c.key === key ? { ...c, details: { ...c.details, ...patch } } : c)));
    setClassErrors(({ [key]: _gone, ...rest }) => rest);
  }

  /** One-on-one has one place; back to Group restores the saved size or the default. */
  function setClassType(card: Card, classType: CardDetails["classType"]) {
    const savedGroup = card.savedDetails?.classType === "group" ? card.savedDetails.capacity : null;
    updateDetails(card.key, {
      classType,
      capacity: classType === "one_on_one" ? 1 : (savedGroup ?? DEFAULT_GROUP_CAPACITY),
    });
  }

  function updateStudents(key: string, list: CardStudent[]) {
    setCards((cs) => cs.map((c) => (c.key === key ? { ...c, students: list } : c)));
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
        savedDetails: null,
        details: { name: "", classType: "group", capacity: DEFAULT_GROUP_CAPACITY },
        students: [],
      },
    ]);
  }

  function save() {
    setError(null);
    setNameError(null);
    // Checked here so each card says what is missing; the server checks too.
    const errors: Record<string, string> = {};
    for (const c of cards) {
      const capacity = c.details.capacity;
      if (!c.current.tutorId) errors[c.key] = "Choose a tutor.";
      else if (c.current.weekday !== null && (!c.current.startTime || !c.current.endTime)) {
        errors[c.key] = "Choose a start and end time.";
      } else if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200) {
        errors[c.key] = "Capacity must be a whole number from 1 to 200.";
      } else {
        const oneOnOne = oneOnOneError(c.details.classType, c.students.filter((s) => !s.leaving).length);
        if (oneOnOne) errors[c.key] = oneOnOne;
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
          classes: cards.filter(dirty).map((c) => {
            const changes = studentChanges(c.students);
            return {
              key: c.key,
              id: c.id,
              weekday: c.current.weekday,
              startTime: c.current.startTime,
              endTime: c.current.endTime,
              tutorId: c.current.tutorId,
              location: c.current.room,
              ...detailsPatch(c.savedDetails, c.details),
              ...(hasStudentChanges(changes) && { students: changes }),
            };
          }),
        });
        if (!result.ok) {
          setError(result.error ?? null);
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
              name: `${formId}-${card.key}-name`,
              type: `${formId}-${card.key}-type`,
              capacity: `${formId}-${card.key}-capacity`,
            };
            const ranked = rankTutorsForSlot(
              tutors,
              tutorWindows,
              classSlots.filter((s) => s.classId !== card.id),
              {
                weekday: card.current.weekday,
                startTime: card.current.startTime || null,
                endTime: card.current.endTime || null,
                subjectId: subject.id,
              },
            );
            const free = ranked.filter((t) => t.fit === "free" || t.fit === "unknown");
            const notFree = ranked.filter((t) => t.fit !== "free" && t.fit !== "unknown");
            return (
              <div
                key={card.key}
                id={card.id ? `class-${card.id}` : undefined}
                className="panel flex scroll-mt-6 flex-col gap-3.5 px-[18px] py-4 target:ring-2 target:ring-[#7C62F0]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                    <span className="text-[15px] font-extrabold text-ink">{card.title}</span>
                    <span className="text-[12px] font-semibold text-[#5E5A73]">{card.meta}</span>
                  </span>
                  {card.id ? (
                    <DeleteClassButton
                      id={card.id}
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
                      {notFree.length === 0 ? (
                        free.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))
                      ) : (
                        <>
                          {free.length > 0 && (
                            <optgroup label="Free then">
                              {free.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          <optgroup label="Not free then">
                            {notFree.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </optgroup>
                        </>
                      )}
                    </SelectField>
                    {ranked.find((t) => t.id === card.current.tutorId)?.note && (
                      <p className="text-[12px] font-semibold text-warn">
                        {ranked.find((t) => t.id === card.current.tutorId)?.note}
                      </p>
                    )}
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5 lg:col-span-1">
                    <label htmlFor={ids.room} className={LBL}>
                      Room
                    </label>
                    <RoomPicker
                      id={ids.room}
                      value={card.current.room}
                      onChange={(room) => update(card.key, { room })}
                      rooms={rooms}
                      slot={card.current}
                      others={others}
                      inputClassName={cn(INPUT, roomChanged && "border-ink")}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 items-start gap-3.5 lg:[grid-template-columns:minmax(0,1fr)_196px_132px]">
                  <div className="col-span-2 flex flex-col gap-1.5 lg:col-span-1">
                    <label htmlFor={ids.name} className={LBL}>
                      Class name
                    </label>
                    <input
                      id={ids.name}
                      value={card.details.name}
                      onChange={(e) => updateDetails(card.key, { name: e.target.value })}
                      placeholder={card.saved ? undefined : "Named from its day and time"}
                      maxLength={200}
                      autoComplete="off"
                      className={INPUT}
                    />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
                    <span id={ids.type} className={LBL}>
                      Type
                    </span>
                    <div
                      role="radiogroup"
                      aria-labelledby={ids.type}
                      className="flex h-10 gap-0.5 rounded-[11px] bg-[#F1F2F7] p-[3px]"
                    >
                      {CLASS_TYPES.map(([value, label]) => {
                        const on = card.details.classType === value;
                        return (
                          <label
                            key={value}
                            className={cn(
                              "flex flex-1 cursor-pointer items-center justify-center whitespace-nowrap rounded-[9px] px-2 text-[13px] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400",
                              on ? "bg-ink font-bold text-white" : "font-semibold text-ink-soft hover:text-ink",
                            )}
                          >
                            <input
                              type="radio"
                              name={`${formId}-${card.key}-type`}
                              value={value}
                              checked={on}
                              onChange={() => setClassType(card, value)}
                              className="sr-only"
                            />
                            {label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  {card.details.classType === "one_on_one" ? (
                    <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
                      <span className={LBL}>Capacity</span>
                      <span className="flex h-10 items-center rounded-[11px] bg-[#F1F2F7] px-3 text-[14px] font-bold text-ink-soft">
                        1 student
                      </span>
                    </div>
                  ) : (
                    <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
                      <label htmlFor={ids.capacity} className={LBL}>
                        Capacity
                      </label>
                      <div className="flex h-10 items-center overflow-hidden rounded-[11px] border border-[#DCDEE9] bg-white focus-within:border-ink focus-within:ring-[3px] focus-within:ring-ink/10">
                        <button
                          type="button"
                          aria-label="Decrease capacity"
                          disabled={card.details.capacity <= 1}
                          onClick={() =>
                            updateDetails(card.key, { capacity: Math.max(1, card.details.capacity - 1) })
                          }
                          className={STEP}
                        >
                          −
                        </button>
                        <input
                          id={ids.capacity}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={200}
                          value={Number.isNaN(card.details.capacity) ? "" : card.details.capacity}
                          onChange={(e) => updateDetails(card.key, { capacity: e.target.valueAsNumber })}
                          className="h-full min-w-0 flex-1 border-0 bg-transparent text-center text-[14px] font-bold tabular-nums text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          aria-label="Increase capacity"
                          disabled={card.details.capacity >= 200}
                          onClick={() =>
                            updateDetails(card.key, { capacity: Math.min(200, (card.details.capacity || 0) + 1) })
                          }
                          className={STEP}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
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

                <ClassStudents
                  students={card.students}
                  capacity={card.details.capacity || 1}
                  oneOnOne={card.details.classType === "one_on_one"}
                  candidates={students}
                  onChange={(list) => updateStudents(card.key, list)}
                />
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
