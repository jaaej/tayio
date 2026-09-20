"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const CELL = {
  type: "spring",
  stiffness: 520,
  damping: 34,
  mass: 0.45,
} as const;
const CROSSFADE = {
  type: "spring",
  stiffness: 260,
  damping: 34,
  mass: 0.8,
} as const;
const INSTANT = { duration: 0 } as const;

export type AsyncActionStatus = "idle" | "pending" | "success" | "error";

export type UseAsyncActionOptions = {
  action: () => unknown;
  resetAfter?: number;
  onError?: (error: unknown) => void;
};

export function useAsyncAction({
  action,
  resetAfter = 1400,
  onError,
}: UseAsyncActionOptions) {
  const [status, setStatus] = useState<AsyncActionStatus>("idle");
  const phase = useRef<AsyncActionStatus>("idle");
  const runId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const act = useRef(action);
  const fail = useRef(onError);

  useEffect(() => {
    act.current = action;
    fail.current = onError;
  });

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    runId.current += 1;
    clear();
    phase.current = "idle";
    setStatus("idle");
  }, [clear]);

  const run = useCallback(() => {
    if (phase.current === "pending") return;

    clear();
    const id = ++runId.current;
    phase.current = "pending";
    setStatus("pending");

    const settle = (next: "success" | "error") => {
      if (!alive.current || id !== runId.current) return;
      clear();
      phase.current = next;
      setStatus(next);
      timer.current = setTimeout(() => {
        if (!alive.current || id !== runId.current) return;
        phase.current = "idle";
        setStatus("idle");
      }, resetAfter);
    };

    Promise.resolve()
      .then(() => act.current())
      .then(
        () => settle("success"),
        (error: unknown) => {
          fail.current?.(error);
          settle("error");
        },
      );
  }, [clear, resetAfter]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clear();
    };
  }, [clear]);

  return { status, run, reset, pending: status === "pending" };
}

export function ActionSpinner({ still = false }: { still?: boolean }) {
  return (
    <motion.svg
      width="13"
      height="13"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
      animate={still ? undefined : { rotate: 360 }}
      transition={
        still ? undefined : { duration: 0.85, repeat: Infinity, ease: "linear" }
      }
    >
      <circle
        cx="6"
        cy="6"
        r="4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.28"
      />
      <path
        d="M10.5 6A4.5 4.5 0 0 0 6 1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </motion.svg>
  );
}

export function ActionButtonLabel({
  pending,
  pendingLabel,
  children,
}: {
  pending: boolean;
  pendingLabel: string;
  children: React.ReactNode;
}) {
  return pending ? (
    <>
      <ActionSpinner />
      {pendingLabel}
    </>
  ) : (
    children
  );
}

function CheckMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M2.6 6.3 4.9 8.6 9.4 3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M6 2.9v3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M6 9.05h.01" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export type LoadingButtonProps = {
  onAction: () => unknown;
  children: string;
  pendingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  resetAfter?: number;
  disabled?: boolean;
  onError?: (error: unknown) => void;
  className?: string;
  variant?: "neutral" | "brand" | "success" | "danger";
  size?: "sm" | "md";
};

const variantClasses = {
  neutral: "border-line-field bg-surface text-ink hover:bg-surface-2",
  brand: "border-brand-600 bg-brand-600 text-white hover:bg-brand-700",
  success: "border-good bg-good text-white hover:brightness-95",
  danger: "border-bad bg-bad text-white hover:brightness-95",
} as const;

export function LoadingButton({
  onAction,
  children,
  pendingLabel = children,
  successLabel = "Done",
  errorLabel = "Try again",
  resetAfter = 1400,
  disabled = false,
  onError,
  className = "",
  variant = "neutral",
  size = "md",
}: LoadingButtonProps) {
  const reduced = useReducedMotion();
  const { status, run, pending } = useAsyncAction({
    action: onAction,
    resetAfter,
    onError,
  });
  const fade = reduced ? INSTANT : CROSSFADE;
  const label =
    status === "pending"
      ? pendingLabel
      : status === "success"
        ? successLabel
        : status === "error"
          ? errorLabel
          : children;

  const faces = [
    { key: "idle", text: children, icon: null },
    {
      key: "pending",
      text: pendingLabel,
      icon: <ActionSpinner still={reduced === true || status !== "pending"} />,
    },
    { key: "success", text: successLabel, icon: <CheckMark /> },
    { key: "error", text: errorLabel, icon: <AlertMark /> },
  ];

  return (
    <>
      <motion.button
        type="button"
        disabled={disabled || pending}
        aria-label={label}
        aria-busy={pending || undefined}
        aria-disabled={disabled || pending || undefined}
        whileTap={disabled || pending || reduced ? undefined : { y: 1 }}
        transition={CELL}
        onClick={(event) => {
          if (disabled || pending) {
            event.preventDefault();
            return;
          }
          run();
        }}
        className={cn(
          "relative inline-flex select-none items-center justify-center rounded-full border px-4 text-[12px] font-bold shadow-[0_1px_2px_rgba(19,27,58,0.08)] outline-none transition-[border-color,box-shadow,background-color] duration-150 focus-visible:ring-2 focus-visible:ring-brand-500/30 disabled:cursor-not-allowed disabled:opacity-50",
          size === "sm" ? "min-h-10" : "min-h-11",
          variantClasses[variant],
          className,
        )}
        style={{ touchAction: "manipulation" }}
      >
        <span aria-hidden className="relative grid place-items-center">
          {faces.map((face) => (
            <motion.span
              key={face.key}
              initial={false}
              animate={
                face.key === status
                  ? { opacity: 1, y: 0, filter: "blur(0px)" }
                  : { opacity: 0, y: 3, filter: "blur(3px)" }
              }
              transition={fade}
              className="col-start-1 row-start-1 flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              {face.icon}
              {face.text}
            </motion.span>
          ))}
        </span>
      </motion.button>

      <span role="status" aria-live="polite" className="sr-only">
        {status === "success"
          ? successLabel
          : status === "error"
            ? errorLabel
            : ""}
      </span>
    </>
  );
}

export default LoadingButton;
