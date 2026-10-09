# Production Supabase health investigation — 8 October 2026

## Remediation applied

Following user authorization, the empty-schema workaround was committed to
`taiyo_portal_prod` at **16:40:45 AEDT / 05:40:45 UTC on 8 October 2026**.
The transaction created `pgrst_no_exposed_schemas`, set the `authenticator`
role's `pgrst.db_schemas` override to that schema, and notified PostgREST to
reload. No database restart was needed.

Verification at approximately 16:41 AEDT:

- PostgREST readiness changed from HTTP **503** before the fix to **200**.
- The new schema contains zero relations and zero functions.
- REST metadata returned HTTP 200 with only the root path and no table
  definitions. Both anon and service-role profiles probes returned HTTP 404 /
  `PGRST205`, looking exclusively in the empty schema. An explicit request for
  the `public` schema returned HTTP 406 / `PGRST106` (schema not exposed).
- The refreshed dashboard still showed **Enable Data API: off**.
- Auth health, Storage health, and the portal login page returned HTTP 200;
  direct database access succeeded.
- All 53 public tables retained enabled RLS; all five storage buckets
  remained private.
- The dashboard's Postgres error filter showed **zero results** for
  16:41:30–16:42:30 AEDT, after the change. The newest missing-placeholder
  error displayed in the preceding 60-minute error view was at 16:40:19,
  before the fix committed. This is an immediate recovery check, not a
  long-term monitoring result.

The separate migration-drift and RLS-audit-script findings below remain open.
The initial read-only investigation is retained below for context.

## Initial investigation

Investigated `taiyo_portal_prod` (`luonvusgnsxxmutugula`, Sydney) at
approximately 16:24–16:30 AEDT (05:24–05:30 UTC). This was a read-only
investigation of the reported unhealthy label. No production settings,
credentials, application data, or schema were changed.

## Assessment

The dashboard reported **Healthy** on both checks during this investigation.
Its service breakdown showed Database, Auth, Realtime, Storage, and Edge
Functions healthy, with PostgREST explicitly **Disabled**.

The persistent fault found was PostgREST repeatedly trying to inspect the
nonexistent schema `pg_pgrst_no_exposed_schemas`. The production Data API toggle
is off. Supabase documents this exact error as a known consequence of disabling
the Data API while PostgREST continues running. This is the likely explanation
for the earlier unhealthy warning; the original unhealthy state was not
observed directly during this investigation.

This is consistent with a service-health/configuration issue. The observations
do not indicate database exhaustion or an active compromise. They do not
constitute a complete forensic review or an authorization-policy penetration
test.

Primary references:

- [Supabase: missing placeholder schema when Data API is disabled](https://supabase.com/docs/guides/troubleshooting/schema-pg_pgrst_no_exposed_schemas-does-not-exist)
- [Supabase: unhealthy services](https://supabase.com/docs/guides/troubleshooting/project-status-reports-unhealthy-services)
- [Supabase: securing the Data API](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase status](https://status.supabase.com/) reported all systems operational at the time of the check.

## Evidence

| Check | Observation |
| --- | --- |
| Project health | Healthy; PostgREST Disabled; remaining five services Healthy |
| Resources | CPU 2%, disk 3%, RAM 34–35%, 8–10 of 60 connections in dashboard snapshots |
| Database connection | Session pooler responded; initial metadata query took 322 ms; subsequent queries approximately 26–43 ms |
| Database size/start | 14 MB; Postgres started 22 August 2026, so no recent database restart |
| Connections | Mostly idle internal service connections; no long-running transaction in the sampled activity summary |
| Replication slots | None, so no inactive replication slot retaining WAL |
| Database logs | 112 Postgres errors in the selected 60-minute window; displayed samples repeated SQLSTATE `3F000` for the missing placeholder schema, approximately every 32 seconds |
| Error source | Selected error ran as `authenticator` from loopback `::1`, executing a PostgREST schema-cache inspection query |
| Readiness logs | Supabase management health probes to `/rest-admin/v1/ready` returned HTTP 503; corresponding Auth probes returned HTTP 200 |
| Auth health | `/auth/v1/health` returned HTTP 200 with the production public API key |
| Storage health | `/storage/v1/status` returned HTTP 200 |
| Data API | Dashboard toggle off; zero-row profiles probes using both anon and service-role credentials returned HTTP 503 / `PGRST002` (schema cache unavailable), with no records returned |
| Public-table RLS | All 53 public tables had RLS enabled; tables with no policies matched the repository's intentional server-only deny-all list |
| Storage privacy | All five buckets private: curriculum, discussion-attachments, homework-attachments, homework-submissions, resource-library |
| Backup | Dashboard reported last backup eight hours earlier; restore was not tested |
| Recent activity | Aggregate queries found no new Auth users, sign-ins, or application audit-log entries in the previous 48 hours |
| Live domain | Login page HTTP 200; public password-recovery JavaScript references this production project |

The overview's low “success rate” includes database log errors and should not
be interpreted as the portal's HTTP request success rate. The repeated
PostgREST error explains the bulk of the visible database error volume.
Loading the login page alone does not verify authenticated portal workflows.
The REST probes establish a schema-cache failure, not successful authorization
enforcement; a 503 response must not be treated as an access-control test.

## Recommended disposition

Keep the Data API disabled. Application database access in `src/` uses
server-side Drizzle; Supabase clients handle Auth and Storage. No runtime
Supabase table-query or RPC use was found. The seed scripts do use Data API
operations and should not be run against production during this investigation.

There is no demonstrated need to restart the database, increase compute, or
enable public-schema API access to address this warning.

If the repeated log noise needs to be removed, Supabase's documented
workaround is to expose an **empty** schema internally to PostgREST while
keeping the dashboard Data API toggle off. The following transaction was
subsequently **applied at 16:40:45 AEDT**, after fresh preflight checks:

```sql
begin;
create schema pgrst_no_exposed_schemas;
alter role authenticator set pgrst.db_schemas = 'pgrst_no_exposed_schemas';
notify pgrst;
commit;
```

Preflight confirmed that this workaround schema is absent and `authenticator`
has no existing `pgrst.db_schemas` role override. Recheck those conditions before
applying. The schema must remain empty. This is an environment configuration
workaround, not an application migration to apply to every database.

After applying, verify that missing-schema errors stop, readiness recovers,
the Data API toggle remains off, REST table requests remain blocked, and Auth,
Storage, and direct SQL access still work. Do not treat a green badge alone as
proof of recovery.

To reverse the role override before intentionally enabling the Data API later:

```sql
alter role authenticator reset pgrst.db_schemas;
notify pgrst;
```

The empty schema can remain in place; rollback does not require dropping data.

## Separate findings requiring follow-up

1. **Production migration drift.** The ledger contains 49 of the checkout's
   52 SQL migrations, ending at `0052`. The `profiles.admin_notes` column and
   `lessons_tutor_date_status_idx` index already exist, so `0053` and `0054`
   appear to have been applied without ledger entries; validate their complete
   effects before stamping them. `student_curriculum_term_grants` is absent,
   confirming the schema change in `0055` has not been applied. Current
   curriculum-access code queries that table and can fail if deployed/used
   against this production schema. This does not explain the PostgREST health
   errors. Review and apply `0055` through the normal migration workflow.

2. **RLS audit blind spot.** `scripts/check-rls.mjs` excludes allowlisted
   server-only tables from its failure predicate even when `relrowsecurity`
   is false. It can therefore report success if RLS is disabled on a sensitive
   allowlisted table such as `tutor_bank_details`. No such failure was found
   in production: this investigation independently checked every table's
   actual RLS flag. Correct the predicate so the allowlist exempts only a
   zero-policy configuration, never disabled RLS. Its suggested fixed-range
   migration replay is also stale and conflicts with `docs/SECURITY.md`.

The health workaround is applied. The separate migration and RLS-audit-script
fixes remain outstanding. Existing uncommitted application changes were left
intact.
