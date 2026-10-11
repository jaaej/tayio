import { cn } from "@/lib/utils";

/**
 * Frosted section frame: the title row sits on a translucent, blurred frame
 * and the content sits on a solid white card inset 6px inside it, so text
 * never reads over a see-through surface. Admin dashboard only for now; it
 * moves to the other roles once the look is approved.
 */
export function GlassPanel({
  title,
  meta,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: React.ReactNode;
  /** Small secondary text beside the title. */
  meta?: React.ReactNode;
  /** Right-aligned controls in the title row. */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "glass-frame flex min-w-0 flex-col rounded-[22px] p-1.5",
        className,
      )}
    >
      <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-3 pb-2 pt-2">
        <h2 className="text-[15px] font-extrabold tracking-[-0.01em] text-ink">
          {title}
        </h2>
        {meta && (
          <span className="text-[12px] font-semibold text-ink-soft">{meta}</span>
        )}
        {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
      </div>
      <div
        className={cn(
          "min-w-0 flex-1 overflow-hidden rounded-[16px] border border-line/70 bg-surface shadow-[0_1px_2px_rgba(15,17,30,0.04)]",
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
