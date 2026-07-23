import Link from "next/link";

export type TabItem = { label: string; href: string; active: boolean };

/**
 * Segmented control mirrored from the parent portal's
 * `src/app/parent/_components/tabs.tsx`. Link-based so tab switches are
 * plain navigations driven by the `tab` search param — no client JS needed.
 */
export function Tabs({ items }: { items: TabItem[] }) {
  return (
    <div className="inline-flex p-1 bg-surface-2 rounded-[10px] gap-0.5">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-[7px] transition-colors ${
            t.active
              ? "bg-card text-ink shadow-[0_1px_0_rgba(15,17,30,0.04),0_1px_2px_rgba(15,17,30,0.04)]"
              : "text-muted hover:text-ink"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
