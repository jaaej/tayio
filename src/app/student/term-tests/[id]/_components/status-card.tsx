import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { Card, CardBody } from "@/components/student/card";

/**
 * Shared "nothing to see yet" card for the not_open and submitted_pending
 * states. Deliberately minimal - the submitted_pending caller must not pass
 * anything derived from score/rank/corrections/board, since results stay
 * embargoed until release.
 */
export function TermTestStatusCard({
  icon: Icon,
  title,
  message,
  hrefBack,
  subjectName,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  hrefBack: string;
  subjectName: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[560px] space-y-4">
      <Link
        href={hrefBack}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[13px] font-bold text-brand-700 transition-colors hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {subjectName}
      </Link>
      <Card accent="var(--brand-500)">
        <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-[16px] bg-brand-100 text-brand-700">
            <Icon className="h-7 w-7" />
          </span>
          <h1 className="text-[19px] font-extrabold tracking-[-0.01em] text-ink">
            {title}
          </h1>
          <p className="max-w-sm text-[14px] font-medium leading-relaxed text-muted">
            {message}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
