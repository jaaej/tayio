"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, Users, X } from "lucide-react";

export type AdminSearchDestination = {
  label: string;
  href: string;
  section: string;
};

export function AdminGlobalSearch({
  destinations,
  compact = false,
  shortcutEnabled = true,
}: {
  destinations: AdminSearchDestination[];
  compact?: boolean;
  shortcutEnabled?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const normalized = query.trim().toLowerCase();
  const matching = useMemo(
    () =>
      destinations.filter((item) =>
        `${item.label} ${item.section}`.toLowerCase().includes(normalized),
      ),
    [destinations, normalized],
  );
  const visible = normalized ? matching : destinations.slice(0, 6);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (
        shortcutEnabled &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setOpen(true);
      } else if (shortcutEnabled && event.key === "/" && !isTyping) {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcutEnabled]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function go(href: string) {
    close();
    router.push(href);
  }

  function searchDirectory() {
    if (!normalized) return;
    go(`/admin/users?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search the portal"
        className={`inline-flex h-[34px] items-center justify-center gap-2 rounded-lg border border-line bg-surface text-muted transition-colors hover:border-brand-300 hover:bg-surface-2 hover:text-ink ${compact ? "w-[34px]" : "px-2.5"}`}
      >
        <Search className="h-[17px] w-[17px]" aria-hidden />
        {!compact ? (
          <>
            <span className="hidden text-[12px] font-bold xl:inline">Search</span>
            <kbd className="hidden rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[9px] font-bold text-muted 2xl:inline">
              ⌘K
            </kbd>
          </>
        ) : null}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[130] flex items-start justify-center bg-ink/55 px-3 pt-[10vh] backdrop-blur-sm sm:pt-[14vh]"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) close();
              }}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-label="Search Taiyo Portal"
                className="w-full max-w-2xl overflow-hidden rounded-[20px] border border-white/20 bg-surface shadow-2xl"
              >
                <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                  <Search className="h-5 w-5 shrink-0 text-brand-600" aria-hidden />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      if (visible[0]) go(visible[0].href);
                      else searchDirectory();
                    }}
                    placeholder="Search users, classes, subjects, or pages…"
                    className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
                  />
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Close search"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="max-h-[62vh] overflow-y-auto p-2">
                  <div className="px-3 pb-1 pt-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                    {normalized ? "Matching pages" : "Portal pages"}
                  </div>
                  {visible.length > 0 ? (
                    visible.map((item) => (
                      <button
                        key={item.href}
                        type="button"
                        onClick={() => go(item.href)}
                        className="flex min-h-12 w-full items-center gap-3 rounded-[12px] px-3 text-left transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-surface-2 text-muted">
                          <Search className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-bold text-ink">
                            {item.label}
                          </span>
                          <span className="block text-[11px] text-muted">
                            {item.section}
                          </span>
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-3 text-[13px] text-muted">
                      No portal page matches this phrase.
                    </p>
                  )}

                  {normalized ? (
                    <>
                      <div className="mx-3 my-2 border-t border-line" />
                      <button
                        type="button"
                        onClick={searchDirectory}
                        className="flex min-h-14 w-full items-center gap-3 rounded-[12px] bg-brand-50 px-3 text-left transition-colors hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-surface text-brand-700">
                          <Users className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-extrabold text-ink">
                            Search users, classes and subjects
                          </span>
                          <span className="block truncate text-[11px] text-muted">
                            Find “{query.trim()}” in the user directory
                          </span>
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-brand-700" />
                      </button>
                    </>
                  ) : null}
                </div>

                <footer className="border-t border-line px-4 py-2 text-[10px] font-semibold text-muted">
                  Press / or ⌘K from anywhere to search.
                </footer>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
