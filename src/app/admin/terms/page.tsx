import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { terms } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { TermForm } from "./_components/term-form";

export default async function AdminTermsPage() {
  await requireRole("admin");
  const allTerms = await db
    .select()
    .from(terms)
    .orderBy(desc(terms.year), desc(terms.termNumber));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-medium tracking-tight text-ink uppercase">
          Terms
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Define academic terms. Curriculum is organised per subject per term.
        </p>
      </header>

      <section className="rounded-2xl border border-hairline/60 bg-card p-5">
        <div className="text-base font-medium text-ink mb-3">Add term</div>
        <TermForm />
      </section>

      <section className="rounded-2xl border border-hairline/60 bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-hairline/60 text-base font-medium text-ink">
          All terms
        </div>
        {allTerms.length === 0 ? (
          <div className="p-6 text-sm text-ink-soft">No terms yet.</div>
        ) : (
          <div className="divide-y divide-hairline/60">
            {allTerms.map((t) => (
              <div key={t.id} className="px-5 py-4">
                <TermForm existing={t} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
