import { beforeEach, describe, expect, it, vi } from "vitest";
import { ATTACHMENT_POLICY } from "./upload-validation";

const remove = vi.fn(async () => ({ data: [], error: null }));
const info = vi.fn();
const download = vi.fn();
const createSignedUploadUrl = vi.fn(async () => ({
  data: { token: "signed-upload-token" },
  error: null,
}));

vi.mock("@/app/admin/_lib/supabase-admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({ createSignedUploadUrl, info, download, remove }),
    },
  }),
}));

import {
  createDirectUploadGrant,
  finalizeDirectUpload,
} from "./direct-upload";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

describe("direct upload grants", () => {
  beforeEach(() => {
    process.env.ADMIN_PIN_SECRET = "test-upload-signing-secret";
    vi.clearAllMocks();
    info.mockResolvedValue({
      data: { size: PDF.length, contentType: "application/pdf" },
      error: null,
    });
    download.mockResolvedValue({
      data: new Blob([PDF], { type: "application/pdf" }),
      error: null,
    });
  });

  async function grant() {
    return createDirectUploadGrant({
      purpose: "tutor-week-attachment",
      userId: "user-1",
      scope: "week-1",
      bucket: "curriculum",
      path: "tutor-sections/section-1/file.pdf",
      fileName: "worksheet.pdf",
      sizeBytes: PDF.length,
      contentType: "application/pdf",
      policy: ATTACHMENT_POLICY,
    });
  }

  it("prepares and verifies a real PDF without sending it through the action", async () => {
    const prepared = await grant();
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const finalized = await finalizeDirectUpload({
      ticket: prepared.value.ticket,
      expectedPurpose: "tutor-week-attachment",
      expectedUserId: "user-1",
      expectedScope: "week-1",
      policy: ATTACHMENT_POLICY,
    });

    expect(finalized).toEqual({
      ok: true,
      value: {
        bucket: "curriculum",
        path: "tutor-sections/section-1/file.pdf",
        fileName: "worksheet.pdf",
        contentType: "application/pdf",
        sizeBytes: PDF.length,
      },
    });
    expect(remove).not.toHaveBeenCalled();
  });

  it("rejects a ticket used by a different user", async () => {
    const prepared = await grant();
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const finalized = await finalizeDirectUpload({
      ticket: prepared.value.ticket,
      expectedPurpose: "tutor-week-attachment",
      expectedUserId: "user-2",
      expectedScope: "week-1",
      policy: ATTACHMENT_POLICY,
    });

    expect(finalized.ok).toBe(false);
    expect(info).not.toHaveBeenCalled();
  });

  it("deletes a spoofed PDF after inspecting its real bytes", async () => {
    const html = new TextEncoder().encode("<html>not a pdf</html>");
    info.mockResolvedValue({
      data: { size: PDF.length, contentType: "application/pdf" },
      error: null,
    });
    download.mockResolvedValue({
      data: new Blob([html.slice(0, PDF.length)], { type: "application/pdf" }),
      error: null,
    });
    const prepared = await grant();
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const finalized = await finalizeDirectUpload({
      ticket: prepared.value.ticket,
      expectedPurpose: "tutor-week-attachment",
      expectedUserId: "user-1",
      expectedScope: "week-1",
      policy: ATTACHMENT_POLICY,
    });

    expect(finalized.ok).toBe(false);
    expect(remove).toHaveBeenCalledWith([
      "tutor-sections/section-1/file.pdf",
    ]);
  });
});
