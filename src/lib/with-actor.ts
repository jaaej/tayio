import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Run mutations inside a transaction with `request.jwt.claims` set, so the
 * audit_logs triggers (migration 0006) capture WHO made the change.
 *
 * Server-side Drizzle connects as the postgres role, so `auth.uid()` /
 * `auth.jwt()` are NULL and audit rows land with a NULL actor. Setting the
 * claims transaction-locally (SET LOCAL via set_config(..., true)) makes the
 * SECURITY DEFINER trigger read the acting user. GUCs are transaction-scoped,
 * so this is safe on the transaction pooler (one connection per tx) and never
 * leaks to another request.
 *
 * Use for any mutation on an audited table: profiles, family_links, classes,
 * enrollments, invoices, announcements. All statements that must be attributed
 * (and stay atomic) go inside `fn`, using the provided `tx`.
 */
export async function withActor<T>(
  actor: { id: string; role: string },
  fn: (tx: DbTx) => Promise<T>,
): Promise<T> {
  const claims = JSON.stringify({
    sub: actor.id,
    role: "authenticated",
    app_metadata: { role: actor.role },
  });
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('request.jwt.claims', ${claims}, true)`,
    );
    return fn(tx);
  });
}
