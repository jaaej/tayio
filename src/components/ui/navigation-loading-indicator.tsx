"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { Swirling } from "@/components/ui/swirling";
import {
  NAVIGATION_LOADING_FINISH,
  NAVIGATION_LOADING_START,
} from "@/lib/navigation-loading";

const MINIMUM_VISIBLE_MS = 300;
const SAFETY_TIMEOUT_MS = 15_000;
type PointerPosition = { x: number; y: number };
let lastPointerPosition: PointerPosition | null = null;
let activeCursorIndicators = 0;

function restoreCursorIfUnused() {
  window.setTimeout(() => {
    if (activeCursorIndicators === 0) {
      document.documentElement.classList.remove("taiyo-navigation-loading");
    }
  }, 0);
}

export function PageLoadingIndicator() {
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<PointerPosition | null>(
    lastPointerPosition,
  );

  useEffect(() => {
    setMounted(true);
    setPosition(
      lastPointerPosition ?? {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      },
    );
    activeCursorIndicators += 1;
    document.documentElement.classList.add("taiyo-navigation-loading");

    function followPointer(event: PointerEvent) {
      if (event.pointerType !== "mouse") return;
      const next = { x: event.clientX, y: event.clientY };
      lastPointerPosition = next;
      setPosition(next);
    }

    window.addEventListener("pointermove", followPointer, { passive: true });
    return () => {
      window.removeEventListener("pointermove", followPointer);
      activeCursorIndicators = Math.max(0, activeCursorIndicators - 1);
      if (activeCursorIndicators === 0) {
        document.documentElement.classList.remove("taiyo-navigation-loading");
      }
    };
  }, []);

  if (!mounted || !position) return null;

  return createPortal(
    <div
      className="taiyo-navigation-cursor-layer pointer-events-none fixed inset-0 z-[9999]"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div
        className="pointer-events-none fixed grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/90 bg-white/95 shadow-[0_7px_18px_-7px_rgba(19,27,58,0.5)]"
        style={{ left: position.x, top: position.y }}
        aria-hidden="true"
      >
        <Swirling className="size-[18px] text-brand-600" />
      </div>
      <span className="sr-only">Loading page…</span>
    </div>,
    document.body,
  );
}

/**
 * Next's loading.tsx boundary only appears for uncached segment loading. This
 * tracker starts at the user's click, so cached links, query-string calendar
 * navigation and browser history transitions receive the same feedback.
 */
export function GlobalNavigationIndicator() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [active, setActive] = useState(false);
  const startedAt = useRef(0);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (finishTimer.current) clearTimeout(finishTimer.current);
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    finishTimer.current = null;
    safetyTimer.current = null;
  }, []);

  const finish = useCallback(() => {
    if (startedAt.current === 0) return;
    if (finishTimer.current) clearTimeout(finishTimer.current);
    const elapsed = Date.now() - startedAt.current;
    const remaining = Math.max(0, MINIMUM_VISIBLE_MS - elapsed);
    finishTimer.current = setTimeout(() => {
      setActive(false);
      startedAt.current = 0;
      clearTimers();
      restoreCursorIfUnused();
    }, remaining);
  }, [clearTimers]);

  const start = useCallback(() => {
    if (startedAt.current === 0) startedAt.current = Date.now();
    if (finishTimer.current) clearTimeout(finishTimer.current);
    // Hide the native arrow in the same event frame as the click. The portal's
    // effect keeps this class alive until every loading boundary has finished.
    document.documentElement.classList.add("taiyo-navigation-loading");
    setActive(true);
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    safetyTimer.current = setTimeout(() => {
      setActive(false);
      startedAt.current = 0;
      clearTimers();
      restoreCursorIfUnused();
    }, SAFETY_TIMEOUT_MS);
  }, [clearTimers]);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (
        !anchor ||
        anchor.hasAttribute("download") ||
        (anchor.target && anchor.target !== "_self") ||
        anchor.dataset.noLoading !== undefined
      ) {
        return;
      }

      const next = new URL(anchor.href, window.location.href);
      if (next.origin !== window.location.origin) return;
      const current = new URL(window.location.href);
      const samePage =
        next.pathname === current.pathname && next.search === current.search;
      if (samePage) return;
      if (event.detail > 0) {
        lastPointerPosition = { x: event.clientX, y: event.clientY };
      }

      // The listener runs during capture so it can see every internal link.
      // Starting the React state update in that same phase can mount the
      // full-screen indicator before Next's Link handler receives the click.
      // Let the click finish first, then show the indicator.
      queueMicrotask(start);
    }

    function rememberPointer(event: PointerEvent) {
      if (event.pointerType !== "mouse") return;
      lastPointerPosition = { x: event.clientX, y: event.clientY };
    }

    function onPopState() {
      start();
    }

    document.addEventListener("click", onDocumentClick, true);
    window.addEventListener("pointermove", rememberPointer, { passive: true });
    window.addEventListener("popstate", onPopState);
    window.addEventListener(NAVIGATION_LOADING_START, start);
    window.addEventListener(NAVIGATION_LOADING_FINISH, finish);
    return () => {
      document.removeEventListener("click", onDocumentClick, true);
      window.removeEventListener("pointermove", rememberPointer);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener(NAVIGATION_LOADING_START, start);
      window.removeEventListener(NAVIGATION_LOADING_FINISH, finish);
      clearTimers();
    };
  }, [clearTimers, finish, start]);

  // A changed route/search string means the new server payload committed.
  // Deliberately do not depend on `active`: doing so would finish immediately
  // when start() flips it before the URL has changed.
  useEffect(() => {
    finish();
  }, [pathname, search, finish]);

  return active ? <PageLoadingIndicator /> : null;
}
