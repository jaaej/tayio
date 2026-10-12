import { SquarePen } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * /tutor/homework: the queue (rendered by the layout) with nothing selected.
 * Wide screens show this resting right pane; phones show only the list.
 */
export default function MarkingPage() {
  return (
    <section
      aria-label="Selected submission"
      className="glass hidden min-h-[420px] flex-col rounded-[24px] p-1.5 xl:flex"
    >
      <div className="panel flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <span
          aria-hidden
          className="grid h-12 w-12 place-items-center rounded-full bg-surface-3 text-muted"
        >
          <SquarePen className="h-[22px] w-[22px]" />
        </span>
        <p className="text-[15px] font-extrabold text-ink">Select a submission to mark</p>
      </div>
    </section>
  );
}
