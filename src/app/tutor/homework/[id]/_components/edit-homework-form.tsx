"use client";

import { useState, useTransition } from "react";
import {
  prepareTutorHomeworkEditAttachmentUpload,
  updateHomework,
} from "@/app/tutor/_actions";
import { Label } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const INPUT_CLS =
  "h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-[13px] text-ink placeholder:text-muted focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/25";

export function EditHomeworkForm({
  homeworkId,
  title,
  description,
  dueDate,
  allowResubmission,
  isTest,
  hasAttachment,
}: {
  homeworkId: string;
  title: string;
  description: string | null;
  dueDate: string;
  allowResubmission: boolean;
  isTest: boolean;
  hasAttachment: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const file = formData.get("attachment");
      if (file instanceof File && file.size > 0) {
        const prepared = await prepareTutorHomeworkEditAttachmentUpload({
          homeworkId,
          fileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        });
        if (!prepared.ok) {
          setError(prepared.error);
          return;
        }

        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from(prepared.value.bucket)
          .uploadToSignedUrl(prepared.value.path, prepared.value.token, file, {
            contentType: prepared.value.contentType,
          });
        if (uploadError) {
          setError(uploadError.message);
          return;
        }
        formData.set("uploadTicket", prepared.value.ticket);
      }

      // Files go browser-to-Storage. Only normal fields and the signed ticket
      // are sent to the Server Action, keeping the request below Vercel's cap.
      formData.delete("attachment");
      await updateHomework(formData);
    });
  }

  return (
    <details className="group">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-[13px] font-bold text-ink [&::-webkit-details-marker]:hidden">
        Edit homework details
        <span className="text-[11px] font-semibold text-brand-600 group-open:hidden">
          Edit ↓
        </span>
        <span className="hidden text-[11px] font-semibold text-muted group-open:inline">
          Close ↑
        </span>
      </summary>
      <form action={submit} className="space-y-3 border-t border-line px-4 py-4">
        <input type="hidden" name="homeworkId" value={homeworkId} />

        <div className="space-y-1">
          <Label htmlFor="edit-title">Title</Label>
          <input
            id="edit-title"
            name="title"
            required
            defaultValue={title}
            maxLength={200}
            className={INPUT_CLS}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="edit-due">Due date</Label>
            <input
              id="edit-due"
              name="dueDate"
              type="datetime-local"
              required
              defaultValue={dueDate}
              className={INPUT_CLS}
            />
          </div>
          <div className="flex flex-col justify-end gap-2 pb-1">
            <label className="flex items-center gap-2 text-[13px] text-ink-soft">
              <input
                type="checkbox"
                name="allowResubmission"
                defaultChecked={allowResubmission}
                className="accent-brand-600"
              />
              Allow resubmission
            </label>
            <label className="flex items-center gap-2 text-[13px] text-ink-soft">
              <input
                type="checkbox"
                name="isTest"
                defaultChecked={isTest}
                className="accent-brand-600"
              />
              Mark as test (counts toward rankings)
            </label>
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="edit-description">Description</Label>
          <textarea
            id="edit-description"
            name="description"
            rows={3}
            defaultValue={description ?? ""}
            placeholder="Description (optional)"
            className={`${INPUT_CLS} h-auto py-2`}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="edit-attachment">
            {hasAttachment ? "Replace attachment" : "Add attachment"}
          </Label>
          <input
            id="edit-attachment"
            name="attachment"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.ppt,.pptx,.txt"
            className="block w-full text-[12px] text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-[12px] file:font-bold file:text-brand-700 hover:file:bg-brand-100"
          />
          {hasAttachment && (
            <label className="mt-1.5 flex items-center gap-2 text-[12px] text-ink-soft">
              <input
                type="checkbox"
                name="removeAttachment"
                className="accent-brand-600"
              />
              Remove the current attachment
            </label>
          )}
        </div>

        {error && (
          <p role="alert" className="text-[12px] font-semibold text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-full bg-brand-600 px-4 text-[12px] font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </details>
  );
}
