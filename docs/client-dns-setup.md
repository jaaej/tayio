# Client DNS setup — completed reference

Last verified: **6 October 2026**.

This was originally the non-technical instruction sheet for the client. The
required portal and Resend records have now been added in GoDaddy and resolve
publicly, so it is retained as a recovery/reference document rather than an
open setup task.

## Current records

| Purpose | Type | Host | Current destination/value |
|---|---|---|---|
| Portal | CNAME | `portal` | `f2e212bdd2bb45bb.vercel-dns-017.com` |
| Resend DKIM | TXT | `resend._domainkey.send` | Public key supplied by Resend; verified in DNS |
| Resend bounce handling | MX | `send.send` | Priority `10`, `feedback-smtp.ap-northeast-1.amazonses.com` |
| Resend SPF | TXT | `send.send` | `v=spf1 include:amazonses.com ~all` |

GoDaddy displays host names relative to `taiyotuition.com`; do not append the
root domain twice. A trailing dot shown by a DNS lookup is normal and should
not be manually added to GoDaddy values unless the UI does it automatically.

The long DKIM value is intentionally not duplicated in this repository. If it
must be recovered or rotated, copy the current value from Resend → Domains and
replace only that matching DNS row.

## What remains for email

DNS verification does not make Supabase Auth use Resend automatically. The
remaining work is:

1. In Supabase, configure or confirm Auth → SMTP with the Resend SMTP host,
   port, username, password, and a sender on the verified domain.
2. Confirm Supabase Site URL and Redirect URLs include
   `https://portal.taiyotuition.com` and its `/auth/callback` route.
3. Test a newly created account and a forgot-password request using a normal
   external inbox, then sign in with the new password.
4. Send a narrowly targeted urgent announcement and verify delivery and
   recipient isolation in both the portal and Resend logs.
5. After delivery is stable, add a DMARC policy for
   `_dmarc.taiyotuition.com`. No DMARC TXT record resolved on 6 October 2026.

Do not call email complete until those tests are recorded in
`checklist_beta_fix.md`.

## Recovery procedure

If `portal.taiyotuition.com` stops resolving:

1. Open GoDaddy → My Products → `taiyotuition.com` → DNS.
2. Confirm the `portal` CNAME still points to the exact target Vercel currently
   shows under Project → Domains.
3. Confirm Vercel still lists `portal.taiyotuition.com` as a Production alias.
4. Check with `dig +short portal.taiyotuition.com CNAME` and
   `npx vercel@latest inspect https://portal.taiyotuition.com`.

If Resend loses domain verification, compare the three records in Resend →
Domains with GoDaddy. Do not delete or edit unrelated website, Microsoft 365,
Google Workspace, or mail records.
