"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/admin/ui";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { requestQuiz } from "@/app/_actions/quizzes";

export function RequestQuizForm({
  tutors,
  weeks,
}: {
  tutors: { id: string; name: string }[];
  weeks: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (tutors.length === 0 || weeks.length === 0) {
    return (
      <p className="text-[13px] text-muted">
        {tutors.length === 0
          ? "Add an active tutor account before requesting a quiz."
          : "No unused subject weeks are available. Add a curriculum week or edit its existing quiz."}
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
        start(async () => {
          const note = String(fd.get("note") || "").trim();
          const res = await requestQuiz({
            subjectWeekId: String(fd.get("subjectWeekId") || ""),
            title: String(fd.get("title") || ""),
            tutorId: String(fd.get("tutorId") || ""),
            note: note.length > 0 ? note : undefined,
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
        <Label htmlFor="req-quiz-tutor">Tutor</Label>
        <Select id="req-quiz-tutor" name="tutorId" required defaultValue="">
          <option value="" disabled>
            Pick a tutor
          </option>
          {tutors.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="req-quiz-week">Subject &amp; week</Label>
        <Select id="req-quiz-week" name="subjectWeekId" required defaultValue="">
          <option value="" disabled>
            Pick a subject week
          </option>
          {weeks.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="req-quiz-title">Title</Label>
        <Input id="req-quiz-title" name="title" required maxLength={200} placeholder="Week 4 quiz" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="req-quiz-note">Note (optional)</Label>
        <textarea
          id="req-quiz-note"
          name="note"
          rows={3}
          maxLength={5000}
          placeholder="Anything the tutor should know before building this quiz"
          className="w-full rounded-xl border border-hairline/60 bg-card px-4 py-2.5 text-sm text-ink placeholder:text-muted/70 transition-colors focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
        />
      </div>
      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" variant="brand" disabled={pending}>
          {pending ? "Sending…" : "Request quiz"}
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
