"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/admin/ui";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createTermTest } from "@/app/_actions/term-tests";

export function NewTermTestForm({
  tutors,
  slots,
}: {
  tutors: { id: string; name: string }[];
  slots: { subjectId: string; termId: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (slots.length === 0) {
    return (
      <p className="text-[13px] text-muted">
        Every subject already has a term test for its current term. Add a new
        term (or a subject) to open up a slot.
      </p>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        const [subjectId, termId] = String(fd.get("slot") || "").split("::");
        const tutorId = String(fd.get("tutorId") || "");
        start(async () => {
          const res = await createTermTest({
            subjectId,
            termId,
            title: String(fd.get("title") || ""),
            tutorId: tutorId.length > 0 ? tutorId : undefined,
          });
          if (res.ok) {
            router.push(`/admin/quizzes/${res.id}`);
          } else {
            setError(res.error);
          }
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="new-term-test-slot">Subject &amp; term</Label>
        <Select id="new-term-test-slot" name="slot" required defaultValue="">
          <option value="" disabled>
            Pick a subject and term
          </option>
          {slots.map((s) => (
            <option key={`${s.subjectId}::${s.termId}`} value={`${s.subjectId}::${s.termId}`}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-term-test-title">Title</Label>
        <Input
          id="new-term-test-title"
          name="title"
          required
          maxLength={200}
          placeholder="Term 2 test"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-term-test-tutor">Assign to a tutor (optional)</Label>
        <Select id="new-term-test-tutor" name="tutorId" defaultValue="">
          <option value="">No tutor - build it myself</option>
          {tutors.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>
      <p className="text-[12px] text-muted">
        Results release automatically at the end of the selected term; you can
        change the release date afterwards from the test&apos;s builder page.
      </p>
      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" variant="brand" disabled={pending}>
          {pending ? "Creating…" : "Create term test"}
        </Button>
        {error && (
          <span role="alert" className="text-[12px] font-semibold text-bad">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
