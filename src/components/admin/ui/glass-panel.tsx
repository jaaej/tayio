import { cn } from "@/lib/utils";

/**
 * The bezel used for every section in the glass redesign: the title row sits
 * on a translucent frame and the content sits on a solid white panel inset
 * 6px inside it, so text never reads over a see-through surface.
 */
export function GlassPanel({
  title,
  titleId,
  meta,
  action,
  children,
  className,
  bodyClassName,
  as: Tag = "section",
}: {
  title?: React.ReactNode;
  titleId?: string;
  /** Small secondary text or a count beside the title. */
  meta?: React.ReactNode;
  /** Right-aligned controls in the title row. */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: "section" | "div" | "nav" | "aside";
}) {
  return (
    <Tag
      aria-labelledby={title && titleId ? titleId : undefined}
      className={cn("glass flex min-w-0 flex-col rounded-[24px] p-1.5", className)}
    >
      {(title || action) && (
        <div className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 py-1.5 pl-3 pr-1.5">
          {title && (
            <h2 id={titleId} className="text-[16px] font-extrabold text-ink">
              {title}
            </h2>
          )}
          {meta && (
            <span className="text-[13px] font-semibold tabular-nums text-ink-soft">
              {meta}
            </span>
          )}
          {action && (
            <div className="ml-auto flex flex-wrap items-center gap-1.5">{action}</div>
          )}
        </div>
      )}
      <div className={cn("panel min-w-0 flex-1 overflow-hidden", bodyClassName)}>
        {children}
      </div>
    </Tag>
  );
}
