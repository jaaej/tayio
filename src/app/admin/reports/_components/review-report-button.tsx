"use client";

import { useState } from "react";
import { Button } from "@/components/admin/ui";
import { TermReportWriter, type ReportTarget } from "@/components/reports/term-report-writer";

/** Open this class's subject of a student's report to read or correct it before sending. */
export function ReviewReportButton({ target }: { target: ReportTarget }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-label={`Review ${target.title}`}
        onClick={() => setOpen(true)}
      >
        Review
      </Button>
      <TermReportWriter target={open ? target : null} onClose={() => setOpen(false)} />
    </>
  );
}
