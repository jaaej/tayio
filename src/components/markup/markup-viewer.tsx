"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AlertCircle, Check, FileText, ImageIcon } from "lucide-react";
import { openMarkup, type OpenedMarkup } from "@/app/_actions/markups";
import { buttonVariants } from "@/components/admin/ui";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ActionSpinner } from "@/components/ui/loading-button";
import { ViewerDialog } from "@/components/ui/viewer-dialog";
import { MARKUP_FONT_FAMILY, PEN_COLORS, PEN_SIZES, HIGHLIGHT_COLORS, TEXT_SIZES, type MarkupItem } from "@/lib/markup/doc";
import { amendHistory, pushHistory, redoHistory, startHistory, undoHistory, type History } from "@/lib/markup/history";
import type { MarkupTarget } from "@/lib/markup/targets";
import { cn } from "@/lib/utils";
import {
  MarkupPages,
  resetTextWidths,
  type MarkupPagesHandle,
  type PageSize,
  type PagesSource,
  type Tool,
} from "./markup-pages";
import { MarkupToolbar } from "./markup-toolbar";
import { openPdf } from "./pdf";
import { useMarkupSave, type SaveStatus } from "./use-markup-save";

/*
 * A PDF or picture opened in the portal for writing on: a student's notes on
 * a worksheet, booklet or library file, or a tutor's marking on a student's
 * submission. Read only for anyone who may only look (a student or parent
 * seeing the tutor's marking). Access is checked on the server for every open
 * and save (`resolveMarkupTarget`).
 */

const HEADER_ACTION =
  "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[12px] font-bold transition-colors";

export function MarkupViewer({
  target,
  title,
  fileKind,
  resubmit = false,
  onClose,
  onSubmitted,
}: {
  target: MarkupTarget;
  title: string;
  /** For the header icon while the file opens. */
  fileKind: "pdf" | "image";
  /** "Submit this file" replaces work handed in before. */
  resubmit?: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [opened, setOpened] = useState<OpenedMarkup | null>(null);
  const [attempt, setAttempt] = useState(0);
  const targetKey = JSON.stringify(target);

  useEffect(() => {
    let live = true;
    setOpened(null);
    openMarkup(JSON.parse(targetKey)).then(
      (result) => live && setOpened(result),
      () => live && setOpened({ ok: false, error: "This file could not be opened. Try again." }),
    );
    return () => {
      live = false;
    };
  }, [attempt, targetKey]);

  const icon = fileKind === "pdf" ? FileText : ImageIcon;
  const noun = fileKind === "pdf" ? "PDF" : "image";

  if (!opened || !opened.ok) {
    return (
      <ViewerDialog open title={title} icon={icon} noun={noun} onClose={onClose}>
        {opened ? (
          <Problem message={opened.error} onRetry={() => setAttempt((n) => n + 1)} />
        ) : (
          <Opening />
        )}
      </ViewerDialog>
    );
  }
  return (
    <MarkupSession
      key={attempt}
      opened={opened}
      target={target}
      title={title}
      resubmit={resubmit}
      onClose={onClose}
      onReload={() => setAttempt((n) => n + 1)}
      onSubmitted={onSubmitted}
    />
  );
}

function MarkupSession({
  opened,
  target,
  title,
  resubmit,
  onClose,
  onReload,
  onSubmitted,
}: {
  opened: Extract<OpenedMarkup, { ok: true }>;
  target: MarkupTarget;
  title: string;
  resubmit: boolean;
  onClose: () => void;
  onReload: () => void;
  onSubmitted: () => void;
}) {
  const editable = opened.editable !== null;
  const [source, setSource] = useState<PagesSource | null>(null);
  const [sourceFailed, setSourceFailed] = useState(false);
  const [history, setHistory] = useState<History>(() => startHistory(opened.editable?.doc.items ?? []));
  const overlays = useRef<MarkupItem[]>(opened.overlays.flatMap((doc) => doc.items)).current;
  // A tutor opens a submission to mark it; everyone else starts by reading.
  const [tool, setTool] = useState<Tool>(opened.defaultPen === "red" ? "pen" : "hand");
  const [inkColor, setInkColor] = useState<string>(opened.defaultPen === "red" ? PEN_COLORS[2] : PEN_COLORS[0]);
  const [penSize, setPenSize] = useState<number>(PEN_SIZES[1]);
  const [highlightColor, setHighlightColor] = useState<string>(HIGHLIGHT_COLORS[0]);
  const [textSize, setTextSize] = useState<number>(TEXT_SIZES[1]);
  const [zoom, setZoom] = useState(1);
  const [closing, setClosing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const pages = useRef<MarkupPagesHandle>(null);
  const { confirm, confirmDialog } = useConfirm();
  // Read after settleText, which ends typing and re-renders before returning.
  const historyRef = useRef(history);
  historyRef.current = history;

  const saver = useMarkupSave({
    target,
    fileVersion: opened.fileVersion,
    initialVersion: opened.editable?.version ?? 0,
    items: history.present,
    enabled: editable,
  });

  // The file itself: every PDF page's size up front (so the scroll height is
  // right from the start), or the picture's size as the browser shows it.
  useEffect(() => {
    let live = true;
    let destroy: (() => void) | null = null;
    (async () => {
      try {
        if (opened.fileKind === "pdf") {
          const pdf = await openPdf(opened.fileUrl);
          destroy = () => void pdf.loadingTask.destroy();
          if (!live) return destroy();
          const sizes: PageSize[] = await Promise.all(
            Array.from({ length: pdf.numPages }, async (_, i) => {
              const viewport = (await pdf.getPage(i + 1)).getViewport({ scale: 1 });
              return { width: viewport.width, height: viewport.height };
            }),
          );
          if (live) setSource({ kind: "pdf", pdf, sizes });
        } else {
          const img = new Image();
          img.src = opened.fileUrl;
          await img.decode();
          if (live) {
            setSource({
              kind: "image",
              url: opened.fileUrl,
              size: { width: img.naturalWidth, height: img.naturalHeight },
              alt: title,
            });
          }
        }
      } catch {
        if (live) setSourceFailed(true);
      }
    })();
    return () => {
      live = false;
      destroy?.();
    };
  }, [opened.fileKind, opened.fileUrl, title]);

  // Typed text is measured in the markup font, so measure again once it arrives.
  const [, setFontReady] = useState(false);
  useEffect(() => {
    let live = true;
    document.fonts?.load(`16px "${MARKUP_FONT_FAMILY}"`).then(() => {
      if (!live) return;
      resetTextWidths();
      setFontReady(true);
    });
    return () => {
      live = false;
    };
  }, []);

  const change = useCallback((next: MarkupItem[], mode: "push" | "amend") => {
    setHistory((current) => (mode === "push" ? pushHistory(current, next) : amendHistory(current, next)));
  }, []);

  /** Ends any typing, so what is on the page is what gets saved. */
  const settleText = useCallback(() => {
    flushSync(() => pages.current?.finishText());
  }, []);

  const undo = useCallback(() => {
    settleText();
    setHistory(undoHistory);
  }, [settleText]);
  const redo = useCallback(() => {
    settleText();
    setHistory(redoHistory);
  }, [settleText]);

  const saveNow = useCallback(() => {
    settleText();
    return saver.save();
  }, [saver, settleText]);

  const requestClose = useCallback(async () => {
    if (closing || submitting) return;
    if (!editable) return onClose();
    settleText();
    if (!saver.hasUnsaved()) return onClose();
    setClosing(true);
    const saved = await saver.save();
    setClosing(false);
    if (saved) return onClose();
    const leave = await confirm({
      title: "Close without saving?",
      body: "Your latest writing on this file isn't saved yet.",
      confirmLabel: "Close anyway",
      cancelLabel: "Keep open",
      danger: true,
    });
    if (leave) onClose();
  }, [closing, confirm, editable, onClose, saver, settleText, submitting]);

  useEffect(() => {
    if (!editable) return;
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void saveNow();
        return;
      }
      // Undo inside the text being typed stays the browser's own.
      if ((event.target as Element | null)?.closest?.("textarea, input")) return;
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editable, redo, saveNow, undo]);

  async function submit() {
    if (submitting) return;
    settleText();
    setSubmitError(null);
    if (historyRef.current.present.length === 0) {
      setSubmitError("Write on the worksheet before submitting it.");
      return;
    }
    const ok = await confirm({
      title: "Submit this worksheet?",
      body: resubmit
        ? "Your tutor gets the worksheet with your writing on it, in place of the work you handed in before."
        : "Your tutor gets the worksheet with your writing on it.",
      confirmLabel: "Submit",
    });
    if (!ok) return;
    setSubmitting(true);
    const saved = await saver.save();
    if (!saved) {
      setSubmitting(false);
      setSubmitError("Your writing isn't saved yet, so it can't be submitted. Try again.");
      return;
    }
    if (target.kind !== "homework-sheet") return;
    try {
      const res = await fetch(`/api/student/homework/${target.homeworkId}/submit-markup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileVersion: opened.fileVersion }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && json?.ok) {
        onSubmitted();
        return;
      }
      setSubmitError(json?.error ?? "The worksheet couldn't be submitted. Try again.");
    } catch {
      setSubmitError("The worksheet couldn't be submitted. Check your connection and try again.");
    }
    setSubmitting(false);
  }

  const status: SaveStatus = saver.status;
  const icon = opened.fileKind === "pdf" ? FileText : ImageIcon;
  const noun = opened.fileKind === "pdf" ? "PDF" : "image";

  return (
    <ViewerDialog
      open
      title={title}
      icon={icon}
      noun={noun}
      downloadUrl={opened.downloadUrl}
      actions={editable ? <SaveButton status={closing ? "saving" : status} onSave={() => void saveNow()} /> : null}
      onClose={() => void requestClose()}
    >
      <MarkupToolbar
        editable={editable}
        tool={tool}
        onTool={setTool}
        inkColor={inkColor}
        onInkColor={setInkColor}
        penSize={penSize}
        onPenSize={setPenSize}
        highlightColor={highlightColor}
        onHighlightColor={setHighlightColor}
        textSize={textSize}
        onTextSize={setTextSize}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onUndo={undo}
        onRedo={redo}
        zoom={zoom}
        onZoom={(factor) => pages.current?.zoomBy(factor)}
        onZoomReset={() => pages.current?.zoomBy(1 / zoom)}
      />
      {opened.replaced && (
        <Notice>This file was replaced after you last wrote on it, so your earlier writing isn&apos;t on this copy.</Notice>
      )}
      {status === "conflict" && (
        <Notice tone="warn">
          <span className="min-w-0 flex-1">This file was also changed in another tab or on another device.</span>
          <span className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void saver.keepMine()}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Keep this version
            </button>
            <button
              type="button"
              onClick={onReload}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Load the other version
            </button>
          </span>
        </Notice>
      )}
      {source ? (
        <MarkupPages
          ref={pages}
          source={source}
          items={history.present}
          overlays={overlays}
          editable={editable}
          tool={editable ? tool : "hand"}
          pen={{ color: inkColor, size: penSize }}
          highlighter={{ color: highlightColor }}
          text={{ color: inkColor, size: textSize }}
          onChange={change}
          onZoomChange={setZoom}
        />
      ) : sourceFailed ? (
        <Problem
          message="This file couldn't be shown here."
          downloadUrl={opened.downloadUrl}
          onRetry={onReload}
        />
      ) : (
        <Opening />
      )}
      {opened.canSubmit && (
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-line bg-surface px-4 py-3">
          {submitError && (
            <p role="alert" className="mr-auto flex items-center gap-2 text-[13px] font-semibold text-bad">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
              {submitError}
            </p>
          )}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting || !source}
            aria-busy={submitting || undefined}
            className={cn(buttonVariants({ variant: "primary", size: "lg" }), "rounded-[11px] px-5")}
          >
            {submitting ? (
              <>
                <ActionSpinner />
                Submitting…
              </>
            ) : (
              "Submit this file"
            )}
          </button>
        </div>
      )}
      {confirmDialog}
    </ViewerDialog>
  );
}

function SaveButton({ status, onSave }: { status: SaveStatus; onSave: () => void }) {
  const label =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "Saved"
        : status === "error"
          ? "Not saved, retry"
          : status === "conflict"
            ? "Not saved"
            : "Save";
  return (
    <button
      type="button"
      onClick={onSave}
      disabled={status === "saving" || status === "saved" || status === "conflict"}
      aria-live="polite"
      className={cn(
        HEADER_ACTION,
        status === "error"
          ? "border-bad/40 bg-bad-bg text-bad hover:brightness-95"
          : status === "saved" || status === "saving"
            ? "border-line text-muted"
            : status === "conflict"
              ? "border-line text-warn"
              : "border-ink bg-ink text-white hover:bg-[#2b2847]",
      )}
    >
      {status === "saving" ? (
        <ActionSpinner />
      ) : status === "saved" ? (
        <Check className="h-3.5 w-3.5" aria-hidden />
      ) : status === "error" ? (
        <AlertCircle className="h-3.5 w-3.5" aria-hidden />
      ) : null}
      {label}
    </button>
  );
}

function Notice({ tone = "info", children }: { tone?: "info" | "warn"; children: React.ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2.5 text-[13px] font-semibold",
        tone === "warn" ? "bg-warn-bg text-warn" : "bg-surface-2 text-ink-soft",
      )}
    >
      {children}
    </div>
  );
}

function Opening() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center gap-2.5 bg-[#E4E6EE] text-[13px] font-semibold text-muted">
      <ActionSpinner />
      Opening file…
    </div>
  );
}

function Problem({
  message,
  downloadUrl,
  onRetry,
}: {
  message: string;
  downloadUrl?: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-[#E4E6EE] px-6 text-center">
      <p className="max-w-[360px] text-[14px] font-semibold text-ink-soft">{message}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onRetry} className={cn(buttonVariants({ variant: "outline", size: "md" }))}>
          Try again
        </button>
        {downloadUrl && (
          <a href={downloadUrl} className={cn(buttonVariants({ variant: "primary", size: "md" }))}>
            Download
          </a>
        )}
      </div>
    </div>
  );
}
