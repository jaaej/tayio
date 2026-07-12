"use client";

import { useState } from "react";
import { FileText, Paperclip } from "lucide-react";
import type { DiscussionAttachmentView } from "@/lib/discussions-queries";

export const ATTACHMENT_ACCEPT =
  "image/png,image/jpeg,image/gif,image/webp,application/pdf";
export const MAX_ATTACHMENTS = 3;

/**
 * Read-only display of a post's attachments: images render as inline thumbnail
 * previews (click to open full size); everything else renders as a file chip.
 */
export function AttachmentList({
  attachments,
  accent = "#4f5bd5",
}: {
  attachments: DiscussionAttachmentView[];
  accent?: string;
}) {
  if (attachments.length === 0) return null;
  const images = attachments.filter((a) => a.isImage && a.url);
  const files = attachments.filter((a) => !a.isImage || !a.url);

  return (
    <div className="mt-3 space-y-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((a) => (
            <a
              key={a.id}
              href={a.url!}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-[12px] border border-line hover:opacity-90 transition-opacity"
              title={a.fileName}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.url!}
                alt={a.fileName}
                className="h-28 w-28 object-cover"
                loading="lazy"
              />
            </a>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((a) =>
            a.url ? (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-background px-3 py-2 text-[12px] font-semibold text-ink hover:bg-surface-2 transition-colors max-w-[240px]"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} />
                <span className="truncate">{a.fileName}</span>
              </a>
            ) : (
              <span
                key={a.id}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-background px-3 py-2 text-[12px] font-semibold text-muted max-w-[240px]"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{a.fileName}</span>
              </span>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/**
 * File picker for a composer form. Renders a hidden multi-file input named
 * "files" (read by the createThread / postReply server actions) plus a live
 * list of chosen filenames. Server enforces the type/size/count limits; this
 * is the affordance + a soft client-side warning past the max.
 */
export function AttachmentPicker({ accent = "#4f5bd5" }: { accent?: string }) {
  const [names, setNames] = useState<string[]>([]);
  const tooMany = names.length > MAX_ATTACHMENTS;

  return (
    <div className="space-y-1.5">
      <label
        className="inline-flex items-center gap-1.5 cursor-pointer rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors hover:bg-surface-2"
        style={{ borderColor: accent, color: accent }}
      >
        <Paperclip className="h-3.5 w-3.5" />
        Attach files
        <input
          name="files"
          type="file"
          multiple
          accept={ATTACHMENT_ACCEPT}
          className="hidden"
          onChange={(e) =>
            setNames(Array.from(e.target.files ?? []).map((f) => f.name))
          }
        />
      </label>
      {names.length > 0 && (
        <div className="text-[11px] text-muted">
          {names.join(", ")}
          {tooMany && (
            <span className="ml-1 font-bold text-bad">
              · max {MAX_ATTACHMENTS} files
            </span>
          )}
        </div>
      )}
      <div className="text-[10px] text-muted-2">
        Images or PDF · up to {MAX_ATTACHMENTS} · 10 MB each
      </div>
    </div>
  );
}
