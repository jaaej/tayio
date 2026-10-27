"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MarkupItem } from "@/lib/markup/doc";
import type { MarkupTarget } from "@/lib/markup/targets";

/*
 * Keeps what someone writes on a file saved: a moment after each change,
 * when they press Save, when they close the file, and when the tab is hidden
 * or closed (a `keepalive` request, which outlives the page). Saves carry the
 * version they started from, so two tabs can't silently overwrite each
 * other: the server answers 409 and the writer picks which copy to keep.
 */

export type SaveStatus = "saved" | "unsaved" | "saving" | "error" | "conflict";

const AUTOSAVE_DELAY_MS = 1500;
/** Browsers cap keepalive request bodies at 64 KB in total. */
const KEEPALIVE_LIMIT = 60_000;
/** Stands for "nothing on the server matches", so the next save always goes. */
const NOTHING_SAVED: MarkupItem[] = [];

type SaveResult = { ok: true; version: number } | { ok: false; conflictVersion: number | null };

async function postSave(payload: string, keepalive = false): Promise<SaveResult> {
  try {
    const res = await fetch("/api/markups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive,
    });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; version?: number } | null;
    if (res.ok && json?.ok && typeof json.version === "number") return { ok: true, version: json.version };
    const conflictVersion = res.status === 409 && typeof json?.version === "number" ? json.version : null;
    return { ok: false, conflictVersion };
  } catch {
    return { ok: false, conflictVersion: null };
  }
}

export function useMarkupSave({
  target,
  fileVersion,
  initialVersion,
  items,
  enabled,
}: {
  target: MarkupTarget;
  fileVersion: string;
  initialVersion: number;
  items: MarkupItem[];
  enabled: boolean;
}) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const itemsRef = useRef(items);
  const savedRef = useRef(items);
  const versionRef = useRef(initialVersion);
  const conflictRef = useRef<number | null>(null);
  const inflight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs, so the callbacks (and the leave listeners) stay put across renders.
  const fileRef = useRef({ target, fileVersion });
  itemsRef.current = items;
  fileRef.current = { target, fileVersion };

  const payloadFor = useCallback(
    (snapshot: MarkupItem[]) =>
      JSON.stringify({ ...fileRef.current, baseVersion: versionRef.current, doc: { v: 1, items: snapshot } }),
    [],
  );

  const settle = useCallback((snapshot: MarkupItem[], result: SaveResult): boolean => {
    if (result.ok) {
      versionRef.current = result.version;
      savedRef.current = snapshot;
      setStatus(itemsRef.current === snapshot ? "saved" : "unsaved");
      return true;
    }
    if (result.conflictVersion !== null) {
      conflictRef.current = result.conflictVersion;
      setStatus("conflict");
    } else {
      setStatus("error");
    }
    return false;
  }, []);

  const saveOnce = useCallback(async (): Promise<boolean> => {
    const snapshot = itemsRef.current;
    setStatus("saving");
    return settle(snapshot, await postSave(payloadFor(snapshot)));
  }, [payloadFor, settle]);

  /** Saves until nothing is left unsaved; changes made during a save go in the next one. */
  const save = useCallback(async (): Promise<boolean> => {
    if (!enabled) return true;
    if (conflictRef.current !== null) return false;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (inflight.current) await inflight.current;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (itemsRef.current === savedRef.current) {
        setStatus("saved");
        return true;
      }
      inflight.current = saveOnce();
      const ok = await inflight.current;
      inflight.current = null;
      if (!ok) return false;
    }
    return itemsRef.current === savedRef.current;
  }, [enabled, saveOnce]);

  // A moment after each change.
  useEffect(() => {
    if (!enabled || items === savedRef.current || conflictRef.current !== null) return;
    setStatus((current) => (current === "saving" ? current : "unsaved"));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
  }, [enabled, items, save]);

  // Leaving the page: it may never come back, so send what is unsaved now in
  // a request that outlives it. A save already on its way carries the same
  // base version, so this one waits for it rather than conflicting with it.
  useEffect(() => {
    if (!enabled) return;
    const sendNow = () => {
      if (itemsRef.current === savedRef.current || conflictRef.current !== null) return;
      if (inflight.current) {
        void inflight.current.then(sendNow);
        return;
      }
      const snapshot = itemsRef.current;
      const payload = payloadFor(snapshot);
      if (payload.length > KEEPALIVE_LIMIT) {
        void save();
        return;
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      const request = postSave(payload, true).then((result) => settle(snapshot, result));
      inflight.current = request;
      void request.finally(() => {
        if (inflight.current === request) inflight.current = null;
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") sendNow();
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (itemsRef.current === savedRef.current || conflictRef.current !== null) return;
      sendNow();
      event.preventDefault();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", sendNow);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", sendNow);
      window.removeEventListener("beforeunload", onBeforeUnload);
      // Closed without the viewer's own close (the browser's back button).
      sendNow();
    };
  }, [enabled, payloadFor, save, settle]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  /** Keeps this copy, replacing the one saved somewhere else. */
  const keepMine = useCallback(async () => {
    if (conflictRef.current === null) return true;
    versionRef.current = conflictRef.current;
    conflictRef.current = null;
    savedRef.current = NOTHING_SAVED;
    return save();
  }, [save]);

  const hasUnsaved = useCallback(() => itemsRef.current !== savedRef.current, []);

  return { status, save, keepMine, hasUnsaved };
}
