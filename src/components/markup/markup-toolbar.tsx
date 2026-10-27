"use client";

import type { ReactNode } from "react";
import { Eraser, Hand, Highlighter, PenLine, Redo2, Type, Undo2, ZoomIn, ZoomOut, type LucideIcon } from "lucide-react";
import { HIGHLIGHT_COLORS, PEN_COLORS, PEN_SIZES, TEXT_SIZES } from "@/lib/markup/doc";
import { cn } from "@/lib/utils";
import { MAX_ZOOM, MIN_ZOOM, type Tool } from "./markup-pages";

const TOOLS: { tool: Tool; label: string; icon: LucideIcon }[] = [
  { tool: "hand", label: "Scroll", icon: Hand },
  { tool: "pen", label: "Pen", icon: PenLine },
  { tool: "highlighter", label: "Highlighter", icon: Highlighter },
  { tool: "text", label: "Text", icon: Type },
  { tool: "eraser", label: "Eraser", icon: Eraser },
];

const PEN_COLOR_NAMES: Record<string, string> = {
  "#1F2333": "Black",
  "#2563EB": "Blue",
  "#DC2626": "Red",
  "#15803D": "Green",
};
const HIGHLIGHT_COLOR_NAMES: Record<string, string> = {
  "#FDE047": "Yellow",
  "#86EFAC": "Green",
  "#F9A8D4": "Pink",
  "#93C5FD": "Blue",
};
const SIZE_NAMES = ["Thin", "Medium", "Thick"];
const TEXT_SIZE_NAMES = ["Small text", "Medium text", "Large text"];

// 44px on touch screens, 36px from tablet width up.
const ICON_BUTTON =
  "grid h-11 w-11 shrink-0 place-items-center rounded-[10px] transition-colors duration-150 sm:h-9 sm:w-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:pointer-events-none disabled:opacity-40";

/**
 * Keeps the text being typed focused while a colour or size is picked. Focus
 * moves on mousedown (also sent after a tap), not pointerdown.
 */
const keepFocus = (event: React.MouseEvent) => event.preventDefault();

export function MarkupToolbar({
  editable,
  tool,
  onTool,
  inkColor,
  onInkColor,
  penSize,
  onPenSize,
  highlightColor,
  onHighlightColor,
  textSize,
  onTextSize,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoom,
  onZoomReset,
}: {
  editable: boolean;
  tool: Tool;
  onTool: (tool: Tool) => void;
  inkColor: string;
  onInkColor: (color: string) => void;
  penSize: number;
  onPenSize: (size: number) => void;
  highlightColor: string;
  onHighlightColor: (color: string) => void;
  textSize: number;
  onTextSize: (size: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoom: (factor: number) => void;
  onZoomReset: () => void;
}) {
  const options =
    tool === "pen" ? (
      <>
        <Swatches colors={PEN_COLORS} names={PEN_COLOR_NAMES} value={inkColor} onChange={onInkColor} />
        <Divider />
        {PEN_SIZES.map((size, i) => (
          <OptionButton key={size} label={SIZE_NAMES[i]} active={penSize === size} onClick={() => onPenSize(size)}>
            <span
              aria-hidden
              className="rounded-full bg-current"
              style={{ width: 4 + i * 4, height: 4 + i * 4 }}
            />
          </OptionButton>
        ))}
      </>
    ) : tool === "highlighter" ? (
      <Swatches colors={HIGHLIGHT_COLORS} names={HIGHLIGHT_COLOR_NAMES} value={highlightColor} onChange={onHighlightColor} />
    ) : tool === "text" ? (
      <>
        <Swatches colors={PEN_COLORS} names={PEN_COLOR_NAMES} value={inkColor} onChange={onInkColor} />
        <Divider />
        {TEXT_SIZES.map((size, i) => (
          <OptionButton
            key={size}
            label={TEXT_SIZE_NAMES[i]}
            active={textSize === size}
            onClick={() => onTextSize(size)}
          >
            <span aria-hidden className="font-extrabold leading-none" style={{ fontSize: 12 + i * 4 }}>
              A
            </span>
          </OptionButton>
        ))}
      </>
    ) : null;

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 border-b border-line bg-surface px-2 py-1 sm:px-4 sm:py-1.5">
      {editable && (
        <div role="toolbar" aria-label="Writing tools" className="flex items-center gap-0.5 sm:gap-1">
          {TOOLS.map(({ tool: t, label, icon: Icon }) => (
            <button
              key={t}
              type="button"
              aria-label={label}
              aria-pressed={tool === t}
              title={label}
              onClick={() => onTool(t)}
              className={cn(
                ICON_BUTTON,
                tool === t ? "bg-ink text-white" : "text-ink-soft hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
            </button>
          ))}
        </div>
      )}
      {options && (
        <div className="order-last flex w-full items-center gap-0.5 border-t border-line pt-0.5 sm:order-none sm:w-auto sm:gap-1 sm:border-l sm:border-t-0 sm:pl-2 sm:pt-0">
          {options}
        </div>
      )}
      <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
        {editable && (
          <>
            <button
              type="button"
              aria-label="Undo"
              title="Undo"
              disabled={!canUndo}
              onClick={onUndo}
              className={cn(ICON_BUTTON, "text-ink-soft hover:bg-surface-2 hover:text-ink")}
            >
              <Undo2 className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Redo"
              title="Redo"
              disabled={!canRedo}
              onClick={onRedo}
              className={cn(ICON_BUTTON, "text-ink-soft hover:bg-surface-2 hover:text-ink")}
            >
              <Redo2 className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
            </button>
          </>
        )}
        {/* Touch screens pinch to zoom; the buttons are for mouse and trackpad. */}
        <div className={cn("items-center gap-0.5", editable ? "hidden sm:flex" : "flex")}>
          {editable && <Divider />}
          <button
            type="button"
            aria-label="Zoom out"
            title="Zoom out"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => onZoom(1 / 1.25)}
            className={cn(ICON_BUTTON, "text-ink-soft hover:bg-surface-2 hover:text-ink")}
          >
            <ZoomOut className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Fit to width"
            title="Fit to width"
            onClick={onZoomReset}
            className="h-11 min-w-12 rounded-[10px] px-1 text-[12px] font-bold tabular-nums text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink sm:h-9"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            title="Zoom in"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => onZoom(1.25)}
            className={cn(ICON_BUTTON, "text-ink-soft hover:bg-surface-2 hover:text-ink")}
          >
            <ZoomIn className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

function Swatches({
  colors,
  names,
  value,
  onChange,
}: {
  colors: readonly string[];
  names: Record<string, string>;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <>
      {colors.map((color) => (
        <OptionButton key={color} label={names[color] ?? color} active={value === color} onClick={() => onChange(color)}>
          <span
            aria-hidden
            className="h-[22px] w-[22px] rounded-full border border-black/10"
            style={{ backgroundColor: color }}
          />
        </OptionButton>
      ))}
    </>
  );
}

function OptionButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onMouseDown={keepFocus}
      onClick={onClick}
      className={cn(
        ICON_BUTTON,
        "text-ink",
        active ? "bg-surface-2 ring-2 ring-inset ring-ink" : "hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 hidden h-6 w-px bg-line sm:block" />;
}
