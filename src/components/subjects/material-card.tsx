import { FileText, Play } from "lucide-react";

/** Full-width button under a material card. */
export const MATERIAL_BUTTON =
  "flex h-10 w-full cursor-pointer items-center justify-center rounded-[12px] text-[14px] font-extrabold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";

/** The quiet grey fill for a button whose work is done (or a secondary one). */
export const MATERIAL_BUTTON_QUIET = "bg-[#F1F2F7] text-ink hover:bg-[#E7E9F1]";

const KINDS = {
  video: { Icon: Play, bg: "#E4ECFF", fg: "#3B6BFF" },
  booklet: { Icon: FileText, bg: "#FDF1E0", fg: "#B45309" },
} as const;

const STATUS_COLOR = {
  waiting: "#9A4A07",
  done: "#15803D",
  neutral: "#5E5A73",
} as const;

/**
 * One card in the curriculum's "Lesson & materials" section, shared by the
 * student and admin pages: the recorded lesson or the week booklet, its
 * status line, then the card's buttons (`children`).
 */
export function MaterialCard({
  kind,
  title,
  status,
  statusTone,
  children,
}: {
  kind: keyof typeof KINDS;
  title: string;
  status: string;
  statusTone: keyof typeof STATUS_COLOR;
  children: React.ReactNode;
}) {
  const { Icon, bg, fg } = KINDS[kind];
  return (
    <div className="panel flex flex-col gap-3.5 p-4">
      <div className="flex items-center gap-3.5">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]"
          style={{ background: bg, color: fg }}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[16px] font-extrabold leading-tight">{title}</span>
          <span className="text-[13px] font-bold" style={{ color: STATUS_COLOR[statusTone] }}>
            {status}
          </span>
        </span>
      </div>
      {children}
    </div>
  );
}
