"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button, SubjectDot } from "@/components/admin/ui";
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
      className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 transition-colors hover:bg-[#F8F9FC]"
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
      <div className="min-w-[160px] flex-1">
        <p className="flex items-center gap-3 text-[14px] font-bold text-ink">
          <SubjectDot subject={subject.subjectName} color={subject.subjectColor} />
          <span className="min-w-0 truncate">{subject.subjectLabel}</span>
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
        aria-label={`Search shortcut for ${subject.subjectLabel}`}
        className="h-9 w-[140px] rounded-[10px] px-2.5 text-[13px] font-semibold"
      />
      <Button
        type="submit"
        size="md"
        variant="outline"
        className="min-w-[70px] text-[12px]"
        disabled={pending || value.trim().toLowerCase() === saved}
      >
        {pending ? "Saving…" : value.trim() ? "Save" : "Clear"}
      </Button>
    </form>
  );
}
