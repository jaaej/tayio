import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { classes } from "@/db/schema";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * A class is edited on its subject's page, with its students, alongside the
 * subject's other classes. Links here (the schedule, notifications, reports,
 * profiles) land on that page at the class's card.
 */
export default async function ClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await db
    .select({ subjectId: classes.subjectId })
    .from(classes)
    .where(eq(classes.id, id));
  if (!row) notFound();
  redirect(`/admin/subjects/${row.subjectId}/edit#class-${id}`);
}
