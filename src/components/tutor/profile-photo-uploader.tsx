"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Trash2, Upload } from "lucide-react";
import {
  prepareTutorProfilePhotoUpload,
  removeMyTutorProfilePhoto,
  saveMyTutorProfilePhoto,
} from "@/app/tutor/profile/actions";
import { ProfileAvatar } from "@/components/profile-avatar";
import { ActionButtonLabel } from "@/components/ui/loading-button";
import { createClient } from "@/lib/supabase/client";

export function ProfilePhotoUploader({
  photoUrl,
  initials,
}: {
  photoUrl: string | null;
  initials: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function upload(file: File) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const prepared = await prepareTutorProfilePhotoUpload({
          fileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        });
        if (!prepared.ok) {
          setError(prepared.error);
          return;
        }

        const { error: uploadError } = await createClient()
          .storage.from(prepared.value.bucket)
          .uploadToSignedUrl(prepared.value.path, prepared.value.token, file, {
            contentType: prepared.value.contentType,
          });
        if (uploadError) {
          setError(uploadError.message);
          return;
        }

        const saved = await saveMyTutorProfilePhoto(prepared.value.ticket);
        if (!saved.ok) {
          setError(saved.error);
          return;
        }

        if (inputRef.current) inputRef.current.value = "";
        setMessage("Profile photo updated.");
        router.refresh();
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Profile photo could not be uploaded.",
        );
      }
    });
  }

  function remove() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        await removeMyTutorProfilePhoto();
        setMessage("Profile photo removed.");
        router.refresh();
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Profile photo could not be removed.",
        );
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-3.5 text-center">
      {photoUrl ? (
        <ProfileAvatar
          avatarKey={null}
          imageUrl={photoUrl}
          fallback={initials}
          className="h-[120px] w-[120px] shrink-0"
        />
      ) : (
        <span
          aria-hidden
          className="grid h-[120px] w-[120px] place-items-center rounded-full border-2 border-dashed border-line-field bg-surface-3 text-muted"
        >
          <Camera className="h-[34px] w-[34px]" strokeWidth={1.6} />
        </span>
      )}
      <div className="flex flex-col items-center">
        <div className="flex flex-wrap justify-center gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[11px] bg-ink px-[18px] text-[14px] font-bold text-white transition-colors hover:bg-[#2b2847] focus-within:ring-2 focus-within:ring-brand-400 focus-within:ring-offset-1">
            <Upload className="h-4 w-4" aria-hidden />
            <ActionButtonLabel pending={pending} pendingLabel="Uploading…">
              {photoUrl ? "Replace photo" : "Upload photo"}
            </ActionButtonLabel>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={pending}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload(file);
              }}
            />
          </label>
          {photoUrl && (
            <button
              type="button"
              disabled={pending}
              onClick={remove}
              className="inline-flex h-10 items-center gap-2 rounded-[11px] bg-bad-bg px-4 text-[14px] font-bold text-bad transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Remove
            </button>
          )}
        </div>
        <p className="mt-2.5 text-[12px] text-muted">JPEG, PNG or WebP up to 5 MB</p>
        {message && (
          <p role="status" className="mt-2 text-[12px] font-semibold text-good">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-[12px] font-semibold text-bad">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
