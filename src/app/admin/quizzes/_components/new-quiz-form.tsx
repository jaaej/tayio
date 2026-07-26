"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/admin/ui";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createQuizDirect } from "@/app/_actions/quizzes";

export function NewQuizForm({ weeks }: { weeks: { id: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (weeks.length === 0) {
    return (
      <p className="text-[13px] text-muted">
        Add a subject week in Classes before creating a quiz.
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
          const res = await createQuizDirect({
            subjectWeekId: String(fd.get("subjectWeekId") || ""),
            title: String(fd.get("title") || ""),
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
        <Label htmlFor="new-quiz-week">Subject &amp; week</Label>
        <Select id="new-quiz-week" name="subjectWeekId" required defaultValue="">
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
        <Label htmlFor="new-quiz-title">Title</Label>
        <Input id="new-quiz-title" name="title" required maxLength={200} placeholder="Week 4 quiz" />
      </div>
      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" variant="brand" disabled={pending}>
          {pending ? "Creating…" : "Create quiz"}
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
