# Manual invoice editing

Implemented locally on 12 September 2026. No database migration is required.

Admin → Payments now exposes a focused Edit panel on each invoice. Admin can
correct the billed parent, optional linked student, amount, currency, due date,
description, workflow status, and the original payment date for paid/refunded
records.

Both the interface and server verify that the selected student is linked to the
selected parent. Paid/refunded records require a payment date; quick status
changes preserve the original date when a paid invoice becomes refunded.

All saves are admin-authenticated and run through `withActor`. The existing
`audit_invoices` database trigger therefore writes actor-attributed before/after
records to the RLS-protected append-only audit log.
