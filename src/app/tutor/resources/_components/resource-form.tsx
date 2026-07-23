"use client";

import { useRef, useState, useTransition } from "react";
import { Link2 as LinkIcon, Plus, Upload } from "lucide-react";
import { addResource } from "@/app/_actions/resources";
import { RESOURCE_TYPES } from "@/lib/resource-types";
import type { AccentTokens } from "@/lib/subject-colors";

export function ResourceForm({
  subjectId,
  topics,
  tokens,
}: {
  subjectId: string;
  topics: Array<{ id: string; name: string }>;
  tokens: AccentTokens;
}) {
  const [kind, setKind] = useState<"file" | "link">("file");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(formData: FormData) {
    formData.set("subjectId", subjectId);
    setError(null);
    startTransition(async () => {
      const res = await addResource(formData);
      if (!res.ok) {
        setError(res.error);
      } else {
        formRef.current?.reset();
        setKind("file");
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={submit}
      className="space-y-3 rounded-[12px] border border-line bg-background p-3.5"
    >
      <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-muted">
        Add resource
      </div>

      <div className="grid sm:grid-cols-2 gap-2.5">
        <select
          name="type"
          required
          defaultValue=""
          className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-line-strong"
        >
          <option value="" disabled>
            Type…
          </option>
          {RESOURCE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          name="topicId"
          defaultValue=""
          className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-line-strong"
        >
          <option value="">No topic</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <input
        name="title"
        required
        maxLength={200}
        placeholder="Title"
        className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-muted focus:outline-none focus:border-line-strong"
      />
      <textarea
        name="description"
        rows={2}
        maxLength={2000}
        placeholder="Description (optional)"
        className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-muted focus:outline-none focus:border-line-strong"
      />

      <input type="hidden" name="kind" value={kind} />
      <div className="flex items-center gap-1.5 rounded-full border border-line bg-surface p-1 w-fit">
        <button
          type="button"
          onClick={() => setKind("file")}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors"
          style={
            kind === "file"
              ? { background: tokens.arrow, color: "#fff" }
              : { color: tokens.arrow }
          }
        >
          <Upload className="h-3.5 w-3.5" /> Upload file
        </button>
        <button
          type="button"
          onClick={() => setKind("link")}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors"
          style={
            kind === "link"
              ? { background: tokens.arrow, color: "#fff" }
              : { color: tokens.arrow }
          }
        >
          <LinkIcon className="h-3.5 w-3.5" /> Paste link
        </button>
      </div>

      {kind === "file" ? (
        <input
          key="file"
          name="file"
          type="file"
          required
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.ppt,.pptx,.txt,.mp4,.mov"
          className="text-[13px] w-full file:mr-2 file:rounded-md file:border file:border-line file:bg-surface file:px-2.5 file:py-1 file:text-[12px] file:font-bold file:text-ink file:cursor-pointer cursor-pointer"
        />
      ) : (
        <input
          key="link"
          name="externalUrl"
          type="url"
          required
          maxLength={2000}
          placeholder="https://…"
          className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-muted focus:outline-none focus:border-line-strong"
        />
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50"
        style={{ background: tokens.arrow }}
      >
        <Plus className="h-3.5 w-3.5" />
        {pending ? "Adding…" : "Add resource"}
      </button>

      {error && (
        <div className="text-[13px] font-semibold text-bad">{error}</div>
      )}
    </form>
  );
}
