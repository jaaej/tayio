import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { terms } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { Card, CardHead, CardBody, PageHeader, Empty } from "@/components/admin/ui";
import { TermForm } from "./_components/term-form";

export default async function AdminTermsPage() {
  await requireRole("admin");
  const allTerms = await db
    .select()
    .from(terms)
    .orderBy(desc(terms.year), desc(terms.termNumber));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Academic Calendar"
        title="Terms"
        sub="Define academic terms. Curriculum is organised per subject per term."
      />

      <Card>
        <CardHead title="Add term" />
        <CardBody>
          <TermForm />
        </CardBody>
      </Card>

      <Card>
        <CardHead title="All terms" />
        {allTerms.length === 0 ? (
          <Empty>No terms yet.</Empty>
        ) : (
          <div className="divide-y divide-line">
            {allTerms.map((t) => (
              <div key={t.id} className="px-5 py-4">
                <TermForm existing={t} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
