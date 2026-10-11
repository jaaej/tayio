import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { terms } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { Empty, PageHeader } from "@/components/admin/ui";
import { GlassPanel } from "@/components/admin/ui/glass-panel";
import { TermForm, TermRow } from "./_components/term-form";

export const dynamic = "force-dynamic";

export default async function AdminTermsPage() {
  await requireRole("admin");
  const allTerms = await db
    .select()
    .from(terms)
    .orderBy(desc(terms.year), desc(terms.termNumber));
  const today = melbourneDate(new Date());

  return (
    <div className="flex max-w-[1000px] flex-col gap-5">
      <PageHeader title="Terms" />

      <GlassPanel title="Add a term" titleId="add-term-heading">
        <div className="p-4">
          <TermForm />
        </div>
      </GlassPanel>

      <GlassPanel
        title="All terms"
        titleId="all-terms-heading"
        meta={allTerms.length > 0 ? allTerms.length : undefined}
      >
        {allTerms.length === 0 ? (
          <Empty>No terms yet.</Empty>
        ) : (
          <>
            <div
              aria-hidden
              className="hidden grid-cols-[88px_120px_minmax(0,1fr)_minmax(0,1fr)_200px] gap-x-3 border-b border-line px-4 pb-2 pt-3 text-[12px] font-extrabold text-muted lg:grid"
            >
              <span>Year</span>
              <span>Term</span>
              <span>Starts</span>
              <span>Ends</span>
              <span />
            </div>
            {allTerms.map((t) => (
              <TermRow
                key={t.id}
                term={t}
                isCurrent={t.startDate <= today && today <= t.endDate}
              />
            ))}
            <p className="border-t border-line bg-surface-2/60 px-4 py-3 text-[12px] text-muted">
              Deleting a term also deletes the curriculum weeks attached to it.
            </p>
          </>
        )}
      </GlassPanel>
    </div>
  );
}
