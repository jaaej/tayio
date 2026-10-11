"use client";

import { useRouter } from "next/navigation";

// Anything that already has its own click meaning inside a row.
const INTERACTIVE =
  "a, button, input, textarea, select, label, summary, details, [role='button'], [contenteditable='true']";

/**
 * A directory row that opens the user's profile when any non-interactive part
 * of it is clicked. The name link stays the keyboard and screen-reader path;
 * this only widens the mouse target, so the row is not given a button role.
 */
export function UserTableRow({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <tr
      onClick={(event) => {
        const target = event.target as HTMLElement;
        // Portaled side panels bubble React events through this row even
        // though their DOM lives elsewhere; only clicks on the row count.
        if (!event.currentTarget.contains(target)) return;
        if (target.closest(INTERACTIVE)) return;
        // Let a user select an email or name without being navigated away.
        if (window.getSelection()?.toString()) return;
        if (event.metaKey || event.ctrlKey) {
          window.open(href, "_blank", "noopener");
          return;
        }
        router.push(href);
      }}
      className="cursor-pointer border-b border-line hover:bg-surface-2 transition-colors"
    >
      {children}
    </tr>
  );
}
