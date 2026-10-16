"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button, SidePanel } from "@/components/admin/ui";
import {
  createSubject,
  deleteSubject,
  getSubjectDeletionImpact,
  updateSubject,
} from "@/app/admin/_lib/actions-subjects";
import { subjectDeletionItems } from "@/app/admin/_lib/deletion-copy";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  SUBJECT_COLORS,
  defaultSubjectColor,
  subjectTone,
  type SubjectColor,
} from "@/lib/subject-tone";
import { cn } from "@/lib/utils";
import { FIELD, Field } from "./class-fields";

type Subject = {
  id: string;
  name: string;
  yearLevel: string | null;
  color: string | null;
};

/**
 * New subject (no `subject`) and Edit subject share one panel: name, year
 * level, and colour, plus Delete when editing. The trigger is part of it.
 */
export function SubjectPanel({ subject }: { subject?: Subject }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(subject?.name ?? "");
  // Null until picked: a new subject's colour follows its name until then.
  const [picked, setPicked] = useState<SubjectColor | null>(null);
  const formId = useId();
  const { confirm, confirmDialog } = useConfirm();

  const color =
    picked ??
    (subject ? subjectTone(subject.name, subject.color).color : defaultSubjectColor(name));

  function openPanel() {
    setName(subject?.name ?? "");
    setPicked(null);
    setError(null);
    setOpen(true);
  }

  function save(fd: FormData) {
    setError(null);
    const values = {
      name: String(fd.get("name") ?? "").trim(),
      yearLevel: String(fd.get("yearLevel") ?? "").trim() || undefined,
      color,
    };
    start(async () => {
      try {
        const result = subject
          ? await updateSubject({ id: subject.id, ...values })
          : await createSubject(values);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setOpen(false);
      } catch {
        setError(subject ? "Could not save the subject." : "Could not add the subject.");
      }
    });
  }

  return (
    <>
      {subject ? (
        <button
          type="button"
          onClick={openPanel}
          aria-label={`Edit ${subject.name}`}
          title="Edit subject"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] text-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <Pencil className="h-4 w-4" strokeWidth={2.2} aria-hidden />
        </button>
      ) : (
        // Glass against the header's dark "New class": both open a panel,
        // but only one is the page's primary action.
        <Button type="button" variant="glass" onClick={openPanel}>
          <Plus className="h-[14px] w-[14px]" strokeWidth={2.4} aria-hidden />
          Add subject
        </Button>
      )}

      <SidePanel
        open={open}
        onClose={() => setOpen(false)}
        title={subject ? "Edit subject" : "New subject"}
        footer={
          <>
            <Button
              type="button"
              size="lg"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" form={formId} size="lg" variant="primary" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <form
          id={formId}
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            save(new FormData(e.currentTarget));
          }}
        >
          <fieldset disabled={pending} className="space-y-5">
            <Field id={`${formId}-name`} label="Subject name">
              <input
                id={`${formId}-name`}
                name="name"
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Maths Methods"
                autoComplete="off"
                className={FIELD}
              />
            </Field>
            <Field id={`${formId}-year`} label="Year level" optional>
              <input
                id={`${formId}-year`}
                name="yearLevel"
                maxLength={40}
                defaultValue={subject?.yearLevel ?? ""}
                placeholder="e.g. Year 10"
                autoComplete="off"
                className={FIELD}
              />
            </Field>
            <ColourPicker name={name} value={color} onChange={setPicked} />
          </fieldset>

          {error && (
            <p role="alert" className="rounded-[12px] bg-bad-bg px-3.5 py-2.5 text-[13px] font-semibold text-bad">
              {error}
            </p>
          )}
        </form>

        {subject && (
          <DeleteSubject
            subject={subject}
            disabled={pending}
            confirm={confirm}
            onDeleted={() => setOpen(false)}
          />
        )}
      </SidePanel>
      {/* Outside the sliding sheet: a fixed dialog inside a transformed
          parent would be confined to it. */}
      {confirmDialog}
    </>
  );
}

/** The ten palette colours as swatches, with a preview of a calendar block. */
function ColourPicker({
  name,
  value,
  onChange,
}: {
  name: string;
  value: SubjectColor;
  onChange: (color: SubjectColor) => void;
}) {
  const labelId = useId();
  const tone = subjectTone(name, value);
  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-[13px] font-bold text-ink">
        Colour <span className="font-medium text-muted">· {tone.label}</span>
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="grid w-fit grid-cols-5 gap-1">
        {SUBJECT_COLORS.map((key) => {
          const swatch = subjectTone("", key);
          const on = key === value;
          return (
            <label
              key={key}
              title={swatch.label}
              className="grid h-11 w-11 cursor-pointer place-items-center rounded-[12px] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400"
            >
              <input
                type="radio"
                name="color"
                value={key}
                checked={on}
                onChange={() => onChange(key)}
                aria-label={swatch.label}
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  "block h-8 w-8 rounded-[9px] transition-shadow duration-150",
                  on && "ring-2 ring-ink ring-offset-2",
                )}
                style={{ backgroundColor: swatch.dot }}
              />
            </label>
          );
        })}
      </div>
      <div
        className="mt-1 rounded-[9px] px-3 py-2 text-[13px] font-extrabold"
        style={{ backgroundColor: tone.bg, color: tone.fg }}
      >
        {name.trim() || "Subject name"}
        <span className="block text-[12px] font-semibold opacity-80">4:00 – 5:30 pm</span>
      </div>
    </div>
  );
}

function DeleteSubject({
  subject,
  disabled,
  confirm,
  onDeleted,
}: {
  subject: Subject;
  disabled: boolean;
  confirm: ReturnType<typeof useConfirm>["confirm"];
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState<"checking" | "deleting" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<{ id: string; name: string }[]>([]);

  async function onDelete() {
    setError(null);
    setBlockers([]);
    setBusy("checking");
    let impact;
    try {
      ({ impact } = await getSubjectDeletionImpact(subject.id));
    } catch {
      setBusy(null);
      setError("Could not check this subject. Try again.");
      return;
    }
    setBusy(null);
    if (impact.classes.length > 0) {
      setBlockers(impact.classes);
      return;
    }

    const ok = await confirm({
      title: `Delete ${subject.name}?`,
      body: impact.hasContent
        ? "This permanently removes the subject and its curriculum:"
        : "This can't be undone.",
      items: subjectDeletionItems(impact),
      confirmText: impact.hasContent ? subject.name : undefined,
      confirmLabel: "Delete subject",
      danger: true,
    });
    if (!ok) return;

    setBusy("deleting");
    try {
      const result = await deleteSubject({
        id: subject.id,
        confirmName: impact.hasContent ? subject.name : undefined,
      });
      setBusy(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDeleted();
    } catch {
      setBusy(null);
      setError("Could not delete the subject. Try again.");
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-2 border-t border-line pt-5">
      <Button
        type="button"
        size="lg"
        variant="danger"
        disabled={disabled || busy !== null}
        onClick={onDelete}
        className="w-full"
      >
        <Trash2 className="h-4 w-4" strokeWidth={2.2} aria-hidden />
        {busy === "checking" ? "Checking…" : busy === "deleting" ? "Deleting…" : "Delete subject"}
      </Button>
      {blockers.length > 0 && (
        <div role="alert" className="rounded-[12px] bg-warn-bg px-3.5 py-2.5 text-[13px] text-warn">
          <p className="font-semibold">
            {blockers.length === 1 ? "1 class uses" : `${blockers.length} classes use`} this
            subject. Delete or move {blockers.length === 1 ? "it" : "them"} first:
          </p>
          <ul className="mt-1.5 space-y-1">
            {blockers.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/classes/${c.id}`}
                  className="font-bold underline underline-offset-2 hover:no-underline"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-[12px] bg-bad-bg px-3.5 py-2.5 text-[13px] font-semibold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
