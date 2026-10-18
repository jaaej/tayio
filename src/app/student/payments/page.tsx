import Link from "next/link";
import { PageHeader, buttonVariants } from "@/components/admin/ui";
import { FamilyInvoices } from "@/components/invoices/family-invoices";
import { requireUnrestrictedStudent } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  getAdminContactForStudent,
  getInvoicesForStudent,
} from "../_lib/queries";

/**
 * Billing-access students only (base students are redirected to their home).
 * Read only: the family invoices view shared with the parent portal. Paying
 * happens by transfer or in person, so there is no pay action here.
 */
export default async function StudentPaymentsPage() {
  const user = await requireUnrestrictedStudent();
  const [rows, office] = await Promise.all([
    getInvoicesForStudent(user.id),
    getAdminContactForStudent(),
  ]);

  return (
    <div className="flex max-w-[1040px] flex-col gap-5">
      <PageHeader
        title="Payments"
        actions={
          office && (
            <Link
              href={`/student/messages/with/${office.id}`}
              className={cn(buttonVariants({ variant: "glass", size: "lg" }), "font-semibold")}
            >
              Message the office
            </Link>
          )
        }
      />
      <FamilyInvoices invoices={rows} now={new Date()} />
    </div>
  );
}
