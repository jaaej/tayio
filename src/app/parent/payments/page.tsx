import Link from "next/link";
import { PageHeader, buttonVariants } from "@/components/admin/ui";
import { FamilyInvoices } from "@/components/invoices/family-invoices";
import { requireRole } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { getAdminContact, getInvoicesForParent } from "../_data";

/**
 * The family's invoices for every child, the same view a student with
 * billing access sees. Read only: payments are made by transfer or in
 * person, so the header opens the office conversation.
 */
export default async function ParentPaymentsPage() {
  const user = await requireRole("parent");
  const [rows, office] = await Promise.all([
    getInvoicesForParent(user.id),
    getAdminContact(),
  ]);

  return (
    <div className="flex max-w-[1040px] flex-col gap-5">
      <PageHeader
        title="Payments"
        actions={
          office && (
            <Link
              href={`/parent/messages/with/${office.id}`}
              className={cn(buttonVariants({ variant: "glass", size: "lg" }), "font-semibold")}
            >
              Message the office
            </Link>
          )
        }
      />
      <FamilyInvoices
        invoices={rows.map((r) => ({
          ...r,
          studentName: [r.studentFirstName, r.studentLastName].filter(Boolean).join(" ") || null,
        }))}
        now={new Date()}
      />
    </div>
  );
}
