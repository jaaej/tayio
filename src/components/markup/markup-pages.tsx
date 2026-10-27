"use client";

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { flushSync } from "react-dom";
import {
  HIGHLIGHT_OPACITY,
  HIGHLIGHT_SIZE,
  MARKUP_FONT_FAMILY,
  MAX_STROKE_POINTS,
  MAX_TEXT_LENGTH,
  PAGE_UNITS,
  TEXT_LINE_HEIGHT,
  textBaselines,
  type InkItem,
  type MarkupItem,
  type TextItem,
} from "@/lib/markup/doc";
import { hitItems, inkOutline, outlinePath } from "@/lib/markup/geometry";
import { cn } from "@/lib/utils";
import type { PDFDocumentProxy } from "./pdf";

/*
 * The pages of a file with the marks drawn over them, and the pen, finger
 * and mouse input that makes marks. Each page is the file's own rendering
 * (a pdf.js canvas, or the picture) under two SVG layers in page units: the
 * highlighter, multiplied into the page so the print stays dark, and the pen
 * and text above it.
 *
 * Touch: a finger writes until an Apple Pencil (or other stylus) is used;
 * from then on the pencil writes and a finger scrolls, as in note-taking
 * apps (a finger tap still places text). Two fingers always scroll and pinch
 * to zoom.
 */

export type Tool = "hand" | "pen" | "highlighter" | "text" | "eraser";
export type PageSize = { width: number; height: number };
export type PagesSource =
  | { kind: "pdf"; pdf: PDFDocumentProxy; sizes: PageSize[] }
  | { kind: "image"; url: string; size: PageSize; alt: string };

export type InkStyle = { color: string; size: number };

export type MarkupPagesHandle = {
  zoomBy(factor: number): void;
  /** Ends any text being typed, keeping it. */
  finishText(): void;
};

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 4;
const MAX_PAGE_WIDTH = 980;
/** Eraser reach in screen pixels, whatever the zoom. */
const ERASER_RADIUS_PX = 10;
/** A press that moves less than this is a tap. */
const TAP_SLOP_PX = 6;
/** Canvas pixels per page, kept lower on iPhone and iPad where canvas memory is tight. */
const MAX_CANVAS_AREA_TOUCH = 5_000_000;
const MAX_CANVAS_AREA = 12_000_000;

const ERASER_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"><circle cx="11" cy="11" r="9" fill="white" fill-opacity="0.6" stroke="#1F2333" stroke-width="1.5"/></svg>',
)}") 11 11, crosshair`;

/** Keeps a pointer's moves coming here; a pointer already lifted can't be captured. */
function capture(el: Element, pointerId: number) {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    // NotFoundError or InvalidStateError: the press already ended.
  }
}

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 18)
    : Math.random().toString(36).slice(2, 14);
}

const round = (n: number) => Math.round(n * 10) / 10;

// Outlines are worked out once per mark: marks never change in place.
const pathCache = new WeakMap<InkItem, string>();
function inkPath(item: InkItem): string {
  let d = pathCache.get(item);
  if (d === undefined) {
    d = outlinePath(inkOutline(item));
    pathCache.set(item, d);
  }
  return d;
}

let measureContext: CanvasRenderingContext2D | null = null;
const widthCache = new Map<string, number>();
/** A text mark's width in page units, in the markup font. */
export function textWidth(item: Pick<TextItem, "size" | "text">): number {
  const key = `${item.size}|${item.text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;
  measureContext ??= document.createElement("canvas").getContext("2d");
  if (!measureContext) return item.text.length * item.size * 0.6;
  measureContext.font = `${item.size}px "${MARKUP_FONT_FAMILY}"`;
  const width = Math.max(0, ...item.text.split("\n").map((line) => measureContext!.measureText(line).width));
  if (widthCache.size > 2000) widthCache.clear();
  widthCache.set(key, width);
  return width;
}

/** Forget widths measured before the markup font arrived. */
export function resetTextWidths() {
  widthCache.clear();
}

type Editing = { item: TextItem; isNew: boolean };

type Gesture =
  | { kind: "draw"; pointerId: number; pageEl: HTMLElement; item: InkItem }
  | { kind: "erase"; pointerId: number; started: boolean }
  | { kind: "pan"; pointerId: number; x: number; y: number; t: number; vx: number; vy: number; glide: boolean }
  | { kind: "pinch"; startDistance: number; startZoom: number; fx: number; fy: number }
  | {
      kind: "text";
      pointerId: number;
      pageEl: HTMLElement;
      page: number;
      startX: number;
      startY: number;
      u: number;
      v: number;
      hit: TextItem | null;
      moved: boolean;
      hadEditor: boolean;
    };

export const MarkupPages = forwardRef<
  MarkupPagesHandle,
  {
    source: PagesSource;
    items: MarkupItem[];
    overlays: MarkupItem[];
    editable: boolean;
    tool: Tool;
    pen: InkStyle;
    highlighter: { color: string };
    text: InkStyle;
    onChange: (next: MarkupItem[], mode: "push" | "amend") => void;
    onZoomChange: (zoom: number) => void;
    onEditingChange?: (editing: boolean) => void;
  }
>(function MarkupPages(
  { source, items, overlays, editable, tool, pen, highlighter, text, onChange, onZoomChange, onEditingChange },
  ref,
) {
  const scroller = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [live, setLive] = useState<InkItem | null>(null);
  const [editing, setEditingState] = useState<Editing | null>(null);
  const [visible, setVisible] = useState<ReadonlySet<number>>(() => new Set([0]));
  const [panning, setPanning] = useState(false);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const editingRef = useRef<Editing | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const stylusSeen = useRef(false);
  const glideFrame = useRef<number | null>(null);
  const liveFrame = useRef<number | null>(null);

  const sizes = source.kind === "pdf" ? source.sizes : [source.size];
  const gutter = viewportWidth > 0 && viewportWidth < 640 ? 8 : 24;
  const fitWidth = Math.max(200, Math.min(MAX_PAGE_WIDTH, viewportWidth - gutter * 2));
  const pageWidth = Math.round(fitWidth * zoom);
  const contentWidth = Math.max(viewportWidth, pageWidth + gutter * 2);

  const setEditing = useCallback(
    (next: Editing | null) => {
      editingRef.current = next;
      setEditingState(next);
      onEditingChange?.(next !== null);
    },
    [onEditingChange],
  );

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setViewportWidth(el.clientWidth));
    observer.observe(el);
    setViewportWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(() => onZoomChange(zoom), [onZoomChange, zoom]);

  // Pages near the screen get drawn; the rest give their canvas memory back.
  const pageEls = useRef(new Map<number, HTMLElement>());
  const observer = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        setVisible((current) => {
          const next = new Set(current);
          for (const entry of entries) {
            const index = Number((entry.target as HTMLElement).dataset.page);
            if (entry.isIntersecting) next.add(index);
            else next.delete(index);
          }
          return next;
        });
      },
      { root, rootMargin: "100% 0px" },
    );
    observer.current = io;
    for (const el of pageEls.current.values()) io.observe(el);
    return () => io.disconnect();
  }, []);
  const registerPage = useCallback((index: number, el: HTMLElement | null) => {
    const previous = pageEls.current.get(index);
    if (previous && previous !== el) observer.current?.unobserve(previous);
    if (el) {
      pageEls.current.set(index, el);
      observer.current?.observe(el);
    } else {
      pageEls.current.delete(index);
    }
  }, []);

  /** Zooms to `next`, keeping the point at (localX, localY) in the scroller where it was. */
  const zoomAround = useCallback(
    (next: number, localX: number, localY: number, fractions?: { fx: number; fy: number }) => {
      const el = scroller.current;
      if (!el) return;
      const z = clampZoom(next);
      const fx = fractions?.fx ?? (el.scrollLeft + localX) / el.scrollWidth;
      const fy = fractions?.fy ?? (el.scrollTop + localY) / el.scrollHeight;
      if (z !== zoomRef.current) {
        flushSync(() => setZoom(z));
        zoomRef.current = z;
      }
      el.scrollLeft = fx * el.scrollWidth - localX;
      el.scrollTop = fy * el.scrollHeight - localY;
    },
    [],
  );

  const commitEditing = useCallback(() => {
    const current = editingRef.current;
    if (!current) return;
    setEditing(null);
    const value = current.item.text.replace(/\s+$/, "");
    const list = itemsRef.current;
    const exists = list.some((item) => item.id === current.item.id);
    if (value.trim() === "") {
      if (exists) onChange(list.filter((item) => item.id !== current.item.id), "push");
      return;
    }
    const next = { ...current.item, text: value };
    const original = list.find((item) => item.id === next.id);
    if (
      original &&
      original.kind === "text" &&
      original.text === next.text &&
      original.color === next.color &&
      original.size === next.size &&
      original.x === next.x &&
      original.y === next.y
    ) {
      return;
    }
    onChange(exists ? list.map((item) => (item.id === next.id ? next : item)) : [...list, next], "push");
  }, [onChange, setEditing]);

  const editText = useCallback(
    (value: string) => {
      const current = editingRef.current;
      if (current) setEditing({ ...current, item: { ...current.item, text: value } });
    },
    [setEditing],
  );

  useImperativeHandle(
    ref,
    () => ({
      zoomBy(factor) {
        const el = scroller.current;
        if (!el) return;
        zoomAround(zoomRef.current * factor, el.clientWidth / 2, el.clientHeight / 2);
      },
      finishText: commitEditing,
    }),
    [commitEditing, zoomAround],
  );

  // Switching tools ends the text being typed.
  useEffect(() => {
    if (tool !== "text") commitEditing();
  }, [commitEditing, tool]);

  // Picking a colour or size while typing restyles that text.
  useEffect(() => {
    const current = editingRef.current;
    if (!current || (current.item.color === text.color && current.item.size === text.size)) return;
    setEditing({ ...current, item: { ...current.item, color: text.color, size: text.size } });
  }, [setEditing, text.color, text.size]);

  // Trackpad pinch: Chrome and Firefox send ctrl+wheel, Safari sends gesture events.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const local = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      return [clientX - rect.left, clientY - rect.top] as const;
    };
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const [x, y] = local(event.clientX, event.clientY);
      zoomAround(zoomRef.current * Math.exp(-event.deltaY / 100), x, y);
    };
    let gestureStart = 1;
    type SafariGesture = Event & { scale: number; clientX: number; clientY: number };
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      gestureStart = zoomRef.current;
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      // On iPhone and iPad two fingers already pinch through pointer events.
      if (touches.current.size > 0) return;
      const g = event as SafariGesture;
      const [x, y] = local(g.clientX, g.clientY);
      zoomAround(gestureStart * g.scale, x, y);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", onGestureStart);
    el.addEventListener("gesturechange", onGestureChange);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
    };
  }, [zoomAround]);

  useEffect(
    () => () => {
      if (glideFrame.current !== null) cancelAnimationFrame(glideFrame.current);
      if (liveFrame.current !== null) cancelAnimationFrame(liveFrame.current);
    },
    [],
  );

  function stopGlide() {
    if (glideFrame.current !== null) cancelAnimationFrame(glideFrame.current);
    glideFrame.current = null;
  }

  function glide(vx: number, vy: number) {
    const el = scroller.current;
    if (!el || Math.hypot(vx, vy) < 0.1) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(32, now - last);
      last = now;
      el.scrollLeft -= vx * dt;
      el.scrollTop -= vy * dt;
      const decay = Math.pow(0.996, dt);
      vx *= decay;
      vy *= decay;
      glideFrame.current = Math.hypot(vx, vy) > 0.02 ? requestAnimationFrame(step) : null;
    };
    glideFrame.current = requestAnimationFrame(step);
  }

  function unitsAt(pageEl: HTMLElement, clientX: number, clientY: number, clamp: boolean): [number, number] {
    const rect = pageEl.getBoundingClientRect();
    const scale = PAGE_UNITS / rect.width;
    let u = (clientX - rect.left) * scale;
    let v = (clientY - rect.top) * scale;
    if (clamp) {
      u = Math.min(PAGE_UNITS, Math.max(0, u));
      v = Math.min(rect.height * scale, Math.max(0, v));
    }
    return [round(u), round(v)];
  }

  function showLive(item: InkItem | null) {
    if (liveFrame.current !== null) return;
    liveFrame.current = requestAnimationFrame(() => {
      liveFrame.current = null;
      const g = gesture.current;
      setLive(g?.kind === "draw" ? { ...g.item, points: g.item.points.slice() } : item);
    });
  }

  function abandon() {
    const g = gesture.current;
    gesture.current = null;
    if (g?.kind === "draw") {
      if (liveFrame.current !== null) cancelAnimationFrame(liveFrame.current);
      liveFrame.current = null;
      setLive(null);
    }
    setPanning(false);
  }

  function startPinch() {
    const el = scroller.current;
    if (!el) return;
    const [a, b] = [...touches.current.values()];
    const rect = el.getBoundingClientRect();
    const midX = (a.x + b.x) / 2 - rect.left;
    const midY = (a.y + b.y) / 2 - rect.top;
    gesture.current = {
      kind: "pinch",
      startDistance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      startZoom: zoomRef.current,
      fx: (el.scrollLeft + midX) / el.scrollWidth,
      fy: (el.scrollTop + midY) / el.scrollHeight,
    };
  }

  function eraseAt(clientX: number, clientY: number) {
    const g = gesture.current;
    if (g?.kind !== "erase") return;
    const pageEl = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-page]");
    if (!pageEl) return;
    const page = Number(pageEl.dataset.page);
    const [u, v] = unitsAt(pageEl, clientX, clientY, false);
    const radius = (ERASER_RADIUS_PX * PAGE_UNITS) / pageEl.getBoundingClientRect().width;
    const hits = hitItems(itemsRef.current, page, u, v, radius, textWidth);
    if (hits.length === 0) return;
    const gone = new Set(hits.map((item) => item.id));
    const next = itemsRef.current.filter((item) => !gone.has(item.id));
    itemsRef.current = next;
    onChange(next, g.started ? "amend" : "push");
    g.started = true;
  }

  function openEditor(item: TextItem, isNew: boolean) {
    flushSync(() => setEditing({ item, isNew }));
    // Focus inside the tap itself, or iPhone and iPad won't show the keyboard.
    textarea.current?.focus({ preventScroll: true });
    const end = item.text.length;
    textarea.current?.setSelectionRange(end, end);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as Element).closest("textarea")) return;
    stopGlide();
    if (event.pointerType === "pen") stylusSeen.current = true;
    if (event.pointerType === "touch") {
      touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.current.size >= 2) {
        abandon();
        startPinch();
        return;
      }
    }
    const el = event.currentTarget;
    const pageEl = (event.target as Element).closest<HTMLElement>("[data-page]");
    // Placing text needs no pencil, so a finger tap still does it (a finger drag scrolls).
    const fingerWrites = event.pointerType !== "touch" || !stylusSeen.current || tool === "text";
    const writes = editable && tool !== "hand" && fingerWrites && pageEl !== null;

    if (!writes || !pageEl) {
      if (event.pointerType === "mouse" && tool !== "hand") return;
      capture(el, event.pointerId);
      gesture.current = {
        kind: "pan",
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        t: event.timeStamp,
        vx: 0,
        vy: 0,
        glide: event.pointerType !== "mouse",
      };
      if (event.pointerType === "mouse") setPanning(true);
      return;
    }

    capture(el, event.pointerId);
    const page = Number(pageEl.dataset.page);
    if (tool === "pen" || tool === "highlighter") {
      const [u, v] = unitsAt(pageEl, event.clientX, event.clientY, true);
      const item: InkItem =
        tool === "pen"
          ? { id: newId(), kind: "pen", page, color: pen.color, size: pen.size, points: [u, v] }
          : { id: newId(), kind: "highlighter", page, color: highlighter.color, size: HIGHLIGHT_SIZE, points: [u, v] };
      gesture.current = { kind: "draw", pointerId: event.pointerId, pageEl, item };
      showLive(item);
    } else if (tool === "eraser") {
      gesture.current = { kind: "erase", pointerId: event.pointerId, started: false };
      eraseAt(event.clientX, event.clientY);
    } else if (tool === "text") {
      const [u, v] = unitsAt(pageEl, event.clientX, event.clientY, true);
      const hit = hitItems(itemsRef.current, page, u, v, 4, textWidth).find(
        (item): item is TextItem => item.kind === "text",
      );
      gesture.current = {
        kind: "text",
        pointerId: event.pointerId,
        pageEl,
        page,
        startX: event.clientX,
        startY: event.clientY,
        u,
        v,
        hit: hit ?? null,
        moved: false,
        hadEditor: editingRef.current !== null,
      };
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" && touches.current.has(event.pointerId)) {
      touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pinch") {
      const el = scroller.current;
      if (!el || touches.current.size < 2) return;
      const [a, b] = [...touches.current.values()];
      const rect = el.getBoundingClientRect();
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAround(
        (g.startZoom * distance) / g.startDistance,
        (a.x + b.x) / 2 - rect.left,
        (a.y + b.y) / 2 - rect.top,
        { fx: g.fx, fy: g.fy },
      );
      return;
    }
    if (g.pointerId !== event.pointerId) return;
    if (g.kind === "pan") {
      const el = scroller.current;
      if (!el) return;
      const dx = event.clientX - g.x;
      const dy = event.clientY - g.y;
      const dt = Math.max(1, event.timeStamp - g.t);
      el.scrollLeft -= dx;
      el.scrollTop -= dy;
      g.vx = 0.8 * (dx / dt) + 0.2 * g.vx;
      g.vy = 0.8 * (dy / dt) + 0.2 * g.vy;
      g.x = event.clientX;
      g.y = event.clientY;
      g.t = event.timeStamp;
      return;
    }
    if (g.kind === "draw") {
      const native = event.nativeEvent;
      const samples = typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];
      const points = g.item.points;
      for (const sample of samples.length > 0 ? samples : [native]) {
        if (points.length >= MAX_STROKE_POINTS * 2) break;
        const [u, v] = unitsAt(g.pageEl, sample.clientX, sample.clientY, true);
        const lastU = points[points.length - 2];
        const lastV = points[points.length - 1];
        if (Math.hypot(u - lastU, v - lastV) < 0.8) continue;
        points.push(u, v);
      }
      showLive(g.item);
      return;
    }
    if (g.kind === "erase") {
      eraseAt(event.clientX, event.clientY);
      return;
    }
    if (g.kind === "text") {
      const far = Math.hypot(event.clientX - g.startX, event.clientY - g.startY) > TAP_SLOP_PX;
      if (!g.moved && !far) return;
      if (!g.hit) {
        // A finger dragging with the text tool scrolls.
        if (event.pointerType === "touch") {
          gesture.current = {
            kind: "pan",
            pointerId: g.pointerId,
            x: event.clientX,
            y: event.clientY,
            t: event.timeStamp,
            vx: 0,
            vy: 0,
            glide: true,
          };
        }
        return;
      }
      const first = !g.moved;
      g.moved = true;
      const [u, v] = unitsAt(g.pageEl, event.clientX, event.clientY, false);
      const moved: TextItem = { ...g.hit, x: round(g.hit.x + u - g.u), y: round(g.hit.y + v - g.v) };
      const next = itemsRef.current.map((item) => (item.id === moved.id ? moved : item));
      itemsRef.current = next;
      onChange(next, first ? "push" : "amend");
      g.hit = moved;
      g.u = u;
      g.v = v;
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    touches.current.delete(event.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pinch") {
      if (touches.current.size < 2) gesture.current = null;
      return;
    }
    if (g.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (g.kind === "pan") {
      setPanning(false);
      if (g.glide && event.timeStamp - g.t < 80) glide(g.vx, g.vy);
      return;
    }
    if (g.kind === "draw") {
      if (liveFrame.current !== null) cancelAnimationFrame(liveFrame.current);
      liveFrame.current = null;
      setLive(null);
      if (event.type === "pointercancel") return;
      const next = [...itemsRef.current, { ...g.item, points: g.item.points.slice() }];
      itemsRef.current = next;
      onChange(next, "push");
      return;
    }
    if (g.kind === "text" && !g.moved && event.type !== "pointercancel") {
      if (g.hadEditor) {
        commitEditing();
        if (!g.hit) return;
      }
      if (g.hit) {
        const current = itemsRef.current.find((item) => item.id === g.hit?.id);
        if (current?.kind === "text") openEditor(current, false);
        return;
      }
      const lineHeight = text.size * TEXT_LINE_HEIGHT;
      openEditor(
        {
          id: newId(),
          kind: "text",
          page: g.page,
          color: text.color,
          size: text.size,
          x: g.u,
          y: round(Math.max(0, g.v - lineHeight / 2)),
          text: "",
        },
        true,
      );
    }
  }

  const byPage = useMemo(() => groupByPage(items), [items]);
  const overlaysByPage = useMemo(() => groupByPage(overlays), [overlays]);

  const cursor =
    !editable || tool === "hand"
      ? panning
        ? "grabbing"
        : "grab"
      : tool === "text"
        ? "text"
        : tool === "eraser"
          ? ERASER_CURSOR
          : "crosshair";

  return (
    <div
      ref={scroller}
      className="relative min-h-0 flex-1 overflow-auto overscroll-contain bg-[#E4E6EE]"
      style={{ touchAction: "none", cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(event) => {
        if (editable && tool !== "hand") event.preventDefault();
      }}
    >
      <div
        className="flex flex-col items-center gap-3 sm:gap-4"
        style={{ width: contentWidth, paddingBlock: gutter, paddingInline: gutter }}
      >
        {viewportWidth > 0 &&
          sizes.map((size, index) => (
            <Page
              key={index}
              index={index}
              size={size}
              width={pageWidth}
              source={source}
              visible={visible.has(index)}
              items={byPage.get(index)}
              overlays={overlaysByPage.get(index)}
              live={live?.page === index ? live : null}
              editing={editing?.item.page === index ? editing.item : null}
              register={registerPage}
              textarea={textarea}
              onEditText={editText}
              onFinishText={commitEditing}
            />
          ))}
      </div>
    </div>
  );
});

function groupByPage(items: readonly MarkupItem[]): Map<number, MarkupItem[]> {
  const map = new Map<number, MarkupItem[]>();
  for (const item of items) {
    const list = map.get(item.page);
    if (list) list.push(item);
    else map.set(item.page, [item]);
  }
  return map;
}

const Page = memo(function Page({
  index,
  size,
  width,
  source,
  visible,
  items,
  overlays,
  live,
  editing,
  register,
  textarea,
  onEditText,
  onFinishText,
}: {
  index: number;
  size: PageSize;
  width: number;
  source: PagesSource;
  visible: boolean;
  items: MarkupItem[] | undefined;
  overlays: MarkupItem[] | undefined;
  live: InkItem | null;
  editing: TextItem | null;
  register: (index: number, el: HTMLElement | null) => void;
  textarea: React.RefObject<HTMLTextAreaElement | null>;
  onEditText: (value: string) => void;
  onFinishText: () => void;
}) {
  const height = Math.round((width * size.height) / size.width);
  const heightUnits = (PAGE_UNITS * size.height) / size.width;
  const all = useMemo(() => [...(overlays ?? []), ...(items ?? [])], [items, overlays]);
  const highlights = all.filter((item): item is InkItem => item.kind === "highlighter");
  const marks = all.filter((item) => item.kind !== "highlighter" && item.id !== editing?.id);
  const ref = useCallback((el: HTMLDivElement | null) => register(index, el), [index, register]);

  return (
    <div
      ref={ref}
      data-page={index}
      className="relative shrink-0 select-none overflow-hidden bg-white shadow-[0_1px_3px_rgba(23,21,43,0.12),0_6px_18px_rgba(23,21,43,0.08)]"
      style={{ width, height }}
    >
      {source.kind === "pdf" ? (
        <PdfCanvas pdf={source.pdf} index={index} width={width} visible={visible} />
      ) : (
        // A short-lived signed URL to a private file; next/image would cache it past its expiry.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={source.url}
          alt={source.alt}
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
        />
      )}
      <svg
        aria-hidden
        viewBox={`0 0 ${PAGE_UNITS} ${heightUnits}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ mixBlendMode: "multiply" }}
      >
        {highlights.map((item) => (
          <path
            key={item.id}
            d={inkPath(item)}
            fill={item.color}
            fillOpacity={HIGHLIGHT_OPACITY}
            style={{ mixBlendMode: "multiply" }}
          />
        ))}
        {live?.kind === "highlighter" && (
          <path
            d={outlinePath(inkOutline(live, false))}
            fill={live.color}
            fillOpacity={HIGHLIGHT_OPACITY}
            style={{ mixBlendMode: "multiply" }}
          />
        )}
      </svg>
      <svg
        aria-hidden
        viewBox={`0 0 ${PAGE_UNITS} ${heightUnits}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        {marks.map((item) =>
          item.kind === "text" ? (
            <TextMark key={item.id} item={item} />
          ) : (
            <path key={item.id} d={inkPath(item as InkItem)} fill={item.color} />
          ),
        )}
        {live?.kind === "pen" && <path d={outlinePath(inkOutline(live, false))} fill={live.color} />}
      </svg>
      {editing && (
        <TextEditor
          key={editing.id}
          item={editing}
          pxPerUnit={width / PAGE_UNITS}
          textarea={textarea}
          onChange={onEditText}
          onDone={onFinishText}
        />
      )}
    </div>
  );
});

function TextMark({ item }: { item: TextItem }) {
  const lines = item.text.split("\n");
  const baselines = textBaselines(item);
  return (
    <text
      fontFamily={`"${MARKUP_FONT_FAMILY}"`}
      fontSize={item.size}
      fill={item.color}
      style={{ whiteSpace: "pre", fontKerning: "none", fontVariantLigatures: "none" }}
    >
      {lines.map((line, i) => (
        <tspan key={i} x={item.x} y={baselines[i]}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/**
 * Typing on the page, in the same font, size and line height the text will
 * have once placed, so nothing jumps when it is done. iPhones zoom the page
 * into any field set below 16px, so small text is typed at 16px and scaled
 * down to its real size.
 */
function TextEditor({
  item,
  pxPerUnit,
  textarea,
  onChange,
  onDone,
}: {
  item: TextItem;
  pxPerUnit: number;
  textarea: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  onDone: () => void;
}) {
  const actual = item.size * pxPerUnit;
  const fontSize = Math.max(actual, 16);
  const scale = actual / fontSize;
  const lines = item.text.split("\n").length;
  const widthPx = (Math.max(textWidth(item), item.size * 0.5) / item.size) * fontSize + fontSize;
  return (
    <textarea
      ref={textarea}
      aria-label="Text on the page"
      value={item.text}
      maxLength={MAX_TEXT_LENGTH}
      wrap="off"
      rows={1}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onDone}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onDone();
        }
      }}
      className={cn(
        "absolute m-0 resize-none overflow-hidden whitespace-pre border-0 bg-white/60 p-0",
        "outline-dashed outline-brand-500",
      )}
      style={{
        left: item.x * pxPerUnit,
        top: item.y * pxPerUnit,
        width: widthPx,
        height: lines * fontSize * TEXT_LINE_HEIGHT,
        fontSize,
        lineHeight: TEXT_LINE_HEIGHT,
        fontFamily: `"${MARKUP_FONT_FAMILY}"`,
        fontKerning: "none",
        fontVariantLigatures: "none",
        color: item.color,
        caretColor: item.color,
        outlineWidth: 1.5 / scale,
        outlineOffset: 2 / scale,
        transform: `scale(${scale})`,
        transformOrigin: "0 0",
      }}
    />
  );
}

/**
 * One PDF page drawn by pdf.js at the screen's pixel density, drawn again
 * (into a fresh canvas swapped in when done, so it never flashes blank)
 * after zooming settles, and dropped when far off screen.
 */
function PdfCanvas({
  pdf,
  index,
  width,
  visible,
}: {
  pdf: PDFDocumentProxy;
  index: number;
  width: number;
  visible: boolean;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const renderedWidth = useRef(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    if (!visible) {
      for (const canvas of el.querySelectorAll("canvas")) {
        canvas.width = 0;
        canvas.height = 0;
      }
      el.replaceChildren();
      renderedWidth.current = 0;
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const wanted = width * dpr;
    if (renderedWidth.current && Math.abs(renderedWidth.current - wanted) / wanted < 0.1) return;

    let cancelled = false;
    let task: { cancel(): void } | null = null;
    const timer = setTimeout(
      async () => {
        try {
          const page = await pdf.getPage(index + 1);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const touch = navigator.maxTouchPoints > 1;
          const maxArea = touch ? MAX_CANVAS_AREA_TOUCH : MAX_CANVAS_AREA;
          let scale = wanted / base.width;
          if (base.width * base.height * scale * scale > maxArea) {
            scale = Math.sqrt(maxArea / (base.width * base.height));
          }
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = "pointer-events-none absolute inset-0 h-full w-full";
          const render = page.render({ canvas, viewport });
          task = render;
          await render.promise;
          if (cancelled) return;
          for (const old of el.querySelectorAll("canvas")) {
            old.width = 0;
            old.height = 0;
          }
          el.replaceChildren(canvas);
          renderedWidth.current = canvas.width;
          setFailed(false);
        } catch (error) {
          if (!cancelled && (error as { name?: string })?.name !== "RenderingCancelledException") setFailed(true);
        }
      },
      renderedWidth.current ? 200 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
      task?.cancel();
    };
  }, [index, pdf, visible, width]);

  return (
    <>
      <div ref={holder} className="pointer-events-none absolute inset-0" />
      {failed && (
        <p className="absolute inset-x-0 top-1/3 px-6 text-center text-[13px] font-semibold text-muted">
          This page couldn&apos;t be shown.
        </p>
      )}
    </>
  );
}

