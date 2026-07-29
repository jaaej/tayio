import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Empty-state block - the reference `.empty`. */
export function Empty({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-6 py-10 text-center text-[13px] text-muted",
        className,
      )}
    >
      {children}
    </div>
  );
}
