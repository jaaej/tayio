"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/admin/ui";
import { saveSubjectSearchAlias } from "../actions";
import type { SubjectSearchAliasRow } from "@/lib/subject-search-aliases";

export function SubjectAliasesForm({
  subjects,
}: {
  subjects: SubjectSearchAliasRow[];
}) {
  return (
    <div className="divide-y divide-line">
      {subjects.map((subject) => (
        <AliasRow key={subject.subjectId} subject={subject} />
      ))}
    </div>
  );
}

function AliasRow({ subject }: { subject: SubjectSearchAliasRow }) {
  const [value, setValue] = useState(subject.alias ?? "");
  const [saved, setSaved] = useState(subject.alias ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="grid items-center gap-3 px-5 py-3.5 sm:grid-cols-[minmax(0,1fr)_180px_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        start(async () => {
          const result = await saveSubjectSearchAlias({
            subjectId: subject.subjectId,
            alias: value,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setValue(result.alias);
          setSaved(result.alias);
        });
      }}
    >
      <div className="min-w-0">
        <p className="truncate text-[13px] font-bold text-ink">
          {subject.subjectName}
        </p>
        {error && (
          <p role="alert" className="mt-1 text-[11px] font-semibold text-bad">
            {error}
          </p>
        )}
      </div>
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={24}
        placeholder="e.g. e1/2"
        aria-label={`Search shortcut for ${subject.subjectName}`}
        className="h-9"
      />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={pending || value.trim().toLowerCase() === saved}
      >
        {pending ? "Saving…" : value.trim() ? "Save" : "Clear"}
      </Button>
    </form>
  );
}
