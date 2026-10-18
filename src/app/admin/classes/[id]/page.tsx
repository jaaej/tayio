import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { classes } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { classEditHref } from "../../_lib/class-links";

export const dynamic = "force-dynamic";

/**
 * A class is edited on its subject's page, with its students, alongside the
 * subject's other classes. The app links there directly (`classEditHref`);
 * this keeps older links, such as notifications already sent, working.
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
  redirect(classEditHref(row.subjectId, id));
}
