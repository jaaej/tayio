import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/app/admin/_lib/supabase-admin";
import {
  validateUpload,
  validateUploadMetadata,
  type UploadPolicy,
} from "@/lib/upload-validation";

const GRANT_LIFETIME_MS = 2 * 60 * 60 * 1000;

type UploadTicket = {
  version: 1;
  purpose: string;
  userId: string;
  scope: string;
  bucket: string;
  path: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
  expiresAt: number;
};

export type DirectUploadGrant = {
  bucket: string;
  path: string;
  token: string;
  ticket: string;
  contentType: string;
};

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function signingSecret(): string {
  const secret =
    process.env.ADMIN_PIN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Missing upload signing secret");
  return secret;
}

function signature(body: string): string {
  return createHmac("sha256", signingSecret()).update(body).digest("base64url");
}

function encodeTicket(payload: UploadTicket): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signature(body)}`;
}

function decodeTicket(ticket: string): UploadTicket | null {
  const [body, suppliedSignature, extra] = ticket.split(".");
  if (!body || !suppliedSignature || extra) return null;

  const expected = Buffer.from(signature(body));
  const supplied = Buffer.from(suppliedSignature);
  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  ) {
    return null;
  }

  try {
    const value = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Partial<UploadTicket>;
    if (
      value.version !== 1 ||
      typeof value.purpose !== "string" ||
      typeof value.userId !== "string" ||
      typeof value.scope !== "string" ||
      typeof value.bucket !== "string" ||
      typeof value.path !== "string" ||
      typeof value.fileName !== "string" ||
      typeof value.sizeBytes !== "number" ||
      typeof value.contentType !== "string" ||
      typeof value.expiresAt !== "number"
    ) {
      return null;
    }
    return value as UploadTicket;
  } catch {
    return null;
  }
}

/**
 * Authorise a browser-to-Storage upload without sending the file through the
 * Vercel Function. The signed Supabase token can write only this exact path;
 * our own HMAC ticket binds the eventual database write to the same user,
 * purpose, scope and file metadata.
 */
export async function createDirectUploadGrant(input: {
  purpose: string;
  userId: string;
  scope: string;
  bucket: string;
  path: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
  policy: UploadPolicy;
}): Promise<Result<DirectUploadGrant>> {
  const validated = validateUploadMetadata(
    { size: input.sizeBytes, type: input.contentType },
    input.policy,
  );
  if (!validated.ok) return validated;

  if (
    !input.path ||
    input.path.startsWith("/") ||
    input.path.includes("..") ||
    !/^[a-zA-Z0-9._/-]+$/.test(input.path)
  ) {
    return { ok: false, error: "Invalid upload path" };
  }

  const payload: UploadTicket = {
    version: 1,
    purpose: input.purpose,
    userId: input.userId,
    scope: input.scope,
    bucket: input.bucket,
    path: input.path,
    fileName: input.fileName.trim().slice(0, 255) || "Attachment",
    sizeBytes: input.sizeBytes,
    contentType: validated.file.contentType,
    expiresAt: Date.now() + GRANT_LIFETIME_MS,
  };

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(input.bucket)
    .createSignedUploadUrl(input.path);
  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Could not prepare the upload",
    };
  }

  return {
    ok: true,
    value: {
      bucket: input.bucket,
      path: input.path,
      token: data.token,
      ticket: encodeTicket(payload),
      contentType: payload.contentType,
    },
  };
}

async function removeObject(bucket: string, path: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.storage.from(bucket).remove([path]);
}

/**
 * Verify that the exact object authorised above arrived before recording it.
 * Metadata is checked twice (ticket vs Storage), and the downloaded object is
 * passed through the existing magic-byte validator. The browser cannot turn a
 * renamed HTML/executable into a trusted PDF by forging File.type.
 */
export async function finalizeDirectUpload(input: {
  ticket: string;
  expectedPurpose: string;
  expectedUserId: string;
  expectedScope: string;
  policy: UploadPolicy;
}): Promise<Result<{
  bucket: string;
  path: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}>> {
  const payload = decodeTicket(input.ticket);
  if (
    !payload ||
    payload.expiresAt < Date.now() ||
    payload.purpose !== input.expectedPurpose ||
    payload.userId !== input.expectedUserId ||
    payload.scope !== input.expectedScope
  ) {
    return { ok: false, error: "Upload authorisation is invalid or expired" };
  }

  const supabase = createAdminClient();
  const bucket = supabase.storage.from(payload.bucket);
  const { data: info, error: infoError } = await bucket.info(payload.path);
  if (infoError || !info) {
    return { ok: false, error: "The uploaded file could not be found" };
  }

  const storedSize = info.size ?? info.metadata?.size;
  const storedType = info.contentType ?? info.metadata?.mimetype;
  if (
    storedSize !== payload.sizeBytes ||
    (storedType && storedType !== payload.contentType)
  ) {
    await removeObject(payload.bucket, payload.path);
    return { ok: false, error: "Uploaded file metadata did not match" };
  }

  const { data: blob, error: downloadError } = await bucket.download(payload.path);
  if (downloadError || !blob) {
    await removeObject(payload.bucket, payload.path);
    return { ok: false, error: "The uploaded file could not be verified" };
  }

  const inspected = new Blob([await blob.arrayBuffer()], {
    type: storedType || payload.contentType,
  });
  const validated = await validateUpload(inspected, input.policy);
  if (
    !validated.ok ||
    validated.file.contentType !== payload.contentType ||
    inspected.size !== payload.sizeBytes
  ) {
    await removeObject(payload.bucket, payload.path);
    return {
      ok: false,
      error: validated.ok
        ? "Uploaded file metadata did not match"
        : validated.error,
    };
  }

  return {
    ok: true,
    value: {
      bucket: payload.bucket,
      path: payload.path,
      fileName: payload.fileName,
      contentType: payload.contentType,
      sizeBytes: payload.sizeBytes,
    },
  };
}

export async function discardDirectUpload(ticket: string): Promise<void> {
  const payload = decodeTicket(ticket);
  if (!payload) return;
  await removeObject(payload.bucket, payload.path);
}
