"use client";

import { useRouter } from "next/navigation";

export function ClassSelect({
  value,
  options,
}: {
  value: string;
  options: { id: string; label: string; meta: string }[];
}) {
  const router = useRouter();
  return (
    <ul className="space-y-1">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => router.push(`/admin/enrolments?class=${o.id}`)}
              className={`w-full text-left px-3 py-2 rounded-lg text-[13px] flex items-center justify-between gap-3 transition-colors ${
                active
                  ? "bg-brand-50 text-brand-700 font-bold"
                  : "text-ink-soft hover:bg-surface-2"
              }`}
            >
              <span className="truncate">{o.label}</span>
              <span className="text-[11px] uppercase tracking-[0.12em] tabular-nums text-muted shrink-0">
                {o.meta}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
