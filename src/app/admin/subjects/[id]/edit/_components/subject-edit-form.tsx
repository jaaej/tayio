"use client";

import Link from "next/link";
import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, GlassPanel, PageHeader, buttonVariants } from "@/components/admin/ui";
import {
  deleteSubject,
  getSubjectDeletionImpact,
  saveSubjectPage,
} from "@/app/admin/_lib/actions-subjects";
import { subjectDeletionItems } from "@/app/admin/_lib/deletion-copy";
import { richText } from "@/app/admin/_components/rich-text";
import { ColourSwatches, LevelSelect } from "@/app/admin/classes/_components/subject-fields";
import type { TutorClassSlot, TutorWeeklyWindow } from "@/app/admin/classes/_lib/tutor-fit";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { subjectTone, type SubjectColor } from "@/lib/subject-tone";
import { DEFAULT_GROUP_CAPACITY, oneOnOneError } from "@/lib/class-capacity";
import { cn } from "@/lib/utils";
import {
  changeNotice,
  detailsPatch,
  hasStudentChanges,
  studentChanges,
  type CardDetails,
  type CardSlot,
  type CardStudent,
} from "../_lib/class-card";
import { ClosedClass, OpenClass, type ClassCardState } from "./class-editor";
import type { StudentOption } from "./student-search";

export type EditClass = {
  id: string;
  /** "22 lessons run" or "starts 24 Oct"; null for a class with neither. */
  history: string | null;
  enrolled: number;
  /** Linked parents of the enrolled students, each counted once. */
  parents: number;
  saved: CardSlot;
  details: CardDetails;
  students: CardStudent[];
};

type Card = ClassCardState;

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

/**
 * The subject and all its classes, saved with one Save changes. One class is
 * open at a time; the others are one-line rows that open on a click.
 */
export function SubjectEditForm({
  subject,
  sub,
  classes,
  tutors,
  rooms,
  lessonMinutes,
  otherSlots,
  tutorWindows,
  classSlots,
  students,
}: {
  subject: { id: string; name: string; yearLevel: string; color: SubjectColor };
  sub: string;
  classes: EditClass[];
  tutors: { id: string; name: string; firstName: string; lastName: string }[];
  /** The Room list: rooms any class uses, then "Online". */
  rooms: string[];
  /** The usual lesson length, for a new class's end time. */
  lessonMinutes: number;
  /** Every weekly class's saved slot and room, to mark a room taken. */
  otherSlots: OtherSlot[];
  /** Tutors' weekly availability, to rank them for each class's slot. */
  tutorWindows: TutorWeeklyWindow[];
  /** Every weekly class, to spot a tutor already teaching then. */
  classSlots: (TutorClassSlot & { classId: string })[];
  /** Every student account, for each class's Add a student. */
  students: (StudentOption & { short: string })[];
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
  const [openKey, setOpenKey] = useState<string | null>(() => classes[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [classErrors, setClassErrors] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState(false);
  const { confirm, confirmDialog } = useConfirm();

  // Links to a class (the old class page, the schedule, notifications) land
  // here with #class-<id>: open that class and bring it into view.
  useEffect(() => {
    const id = window.location.hash.match(/^#class-([0-9a-f-]{36})$/i)?.[1];
    if (!id || !classes.some((c) => c.id === id)) return;
    setOpenKey(id);
    requestAnimationFrame(() => document.getElementById(`class-${id}`)?.scrollIntoView({ block: "start" }));
  }, [classes]);

  const tutorName = (id: string) => tutors.find((t) => t.id === id)?.name ?? null;
  const dot = subjectTone(subject.name, color).dot;

  /** Show errors and open the first class that has one. */
  function showErrors(errors: Record<string, string>) {
    setClassErrors(errors);
    const first = cards.find((c) => errors[c.key]);
    if (first) setOpenKey(first.key);
  }

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
    setClassErrors(({ [key]: _gone, ...rest }) => rest);
  }

  function addClass() {
    const key = `new-${crypto.randomUUID()}`;
    setCards((cs) => [
      ...cs,
      {
        key,
        history: null,
        enrolled: 0,
        parents: 0,
        saved: null,
        current: { ...EMPTY_SLOT, tutorId: tutors.length === 1 ? tutors[0].id : "" },
        savedDetails: null,
        details: { name: "", classType: "group", capacity: DEFAULT_GROUP_CAPACITY },
        students: [],
      },
    ]);
    setOpenKey(key);
  }

  function dropCard(key: string) {
    setCards((cs) => cs.filter((c) => c.key !== key));
    setOpenKey(null);
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
    showErrors(errors);
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
          showErrors(result.classErrors ?? {});
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
          as="section"
          bodyClassName="flex flex-wrap items-end gap-x-5 gap-y-3.5 px-[18px] py-3.5"
        >
          <div className="flex min-w-0 flex-[2_1_260px] flex-col gap-1.5">
            <label htmlFor={`${formId}-name`} className={LBL}>
              Subject name
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
          <div className="flex min-w-[140px] flex-[0_1_160px] flex-col gap-1.5">
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
          <div className="flex flex-col gap-2.5">
            <span id={`${formId}-colour`} className={LBL}>
              Colour
            </span>
            <div className="pb-[7px] pl-0.5">
              <ColourSwatches value={color} onChange={setColor} labelledBy={`${formId}-colour`} size="sm" />
            </div>
          </div>
          <Link
            href={`/admin/subjects/${subject.id}/curriculum`}
            className="ml-auto pb-3 text-[13px] font-bold text-[#3A1AA8] hover:text-[#21106B]"
          >
            Open curriculum
          </Link>
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
          bodyClassName="overflow-visible"
        >
          {cards.length === 0 && (
            <p className="px-5 py-6 text-center text-[14px] text-ink-soft">No classes yet.</p>
          )}
          {cards.map((card) => {
            if (card.key !== openKey) {
              return (
                <ClosedClass
                  key={card.key}
                  card={card}
                  subjectName={subject.name}
                  tutorName={tutorName}
                  error={classErrors[card.key]}
                  onOpen={() => setOpenKey(card.key)}
                />
              );
            }
            const others = [
              ...otherSlots.filter((o) => !cards.some((c) => c.id === o.classId)),
              ...cards.filter((c) => c.key !== card.key).map((c) => c.current),
            ];
            const notice = card.saved
              ? changeNotice(card.saved, card.current, {
                  tutorName: tutorName(card.current.tutorId) ?? "the tutor",
                  oldTutorName: tutorName(card.saved.tutorId) ?? "the tutor",
                  students: card.enrolled,
                  parents: card.parents,
                })
              : null;
            return (
              <OpenClass
                key={card.key}
                card={card}
                formId={formId}
                subjectId={subject.id}
                subjectName={subject.name}
                tutors={tutors}
                tutorWindows={tutorWindows}
                classSlots={classSlots}
                rooms={rooms}
                lessonMinutes={lessonMinutes}
                others={others}
                candidates={students}
                notice={notice}
                error={classErrors[card.key]}
                onClose={() => setOpenKey(null)}
                onSlot={(patch) => update(card.key, patch)}
                onDetails={(patch) => updateDetails(card.key, patch)}
                onType={(classType) => setClassType(card, classType)}
                onStudents={(list) => updateStudents(card.key, list)}
                onRemove={() => dropCard(card.key)}
                onDeleted={() => {
                  dropCard(card.key);
                  router.refresh();
                }}
              />
            );
          })}
        </GlassPanel>

        <button
          type="button"
          onClick={onDeleteSubject}
          disabled={deleting || pending}
          className="self-start rounded-[8px] px-1.5 py-1 text-[13px] font-bold text-[#B42318] transition-colors hover:bg-[#FDE8E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60 pointer-coarse:py-3"
        >
          {deleting ? "Working…" : `Delete ${subject.name}…`}
        </button>
      </fieldset>
      {confirmDialog}
    </form>
  );
}
