# DNS setup - instructions to send to the client

Hand this to whoever manages `taiyotuition.com`.
Written for a non-technical reader; no jargon is used before it is explained.

Fill in the four bracketed values before sending - the email records come from the Resend dashboard after adding the domain there (step 2 of the deploy setup sequence).

---

## What this is for

We are putting the tutoring portal online at **portal.taiyotuition.com**.

That is a new section of your existing web address, like a new room in a house you already own.
Your current website at `taiyotuition.com` is not touched and will keep working exactly as it does now.

To connect it, four settings need to be added to your domain.
It takes about ten minutes and nothing here can break your existing site.

---

## Step 1 - find where your domain is managed

Your domain is registered with a company you pay a yearly fee to. Common ones: **GoDaddy, Namecheap, Squarespace, Wix, Shopify, Cloudflare, Crazy Domains**.

If you are not sure which:

- Search your email for "domain renewal" or "domain expiring" - the sender is the company.
- Or check your card statement for a small yearly charge.
- Or ask whoever originally built your website, since they often set it up.

Log in to that company's website.

## Step 2 - find the DNS settings

Once logged in, find your domain `taiyotuition.com` and look for a button or menu called one of:

- **DNS**
- **Manage DNS**
- **DNS Settings**
- **Advanced DNS**
- **DNS Records**
- **Nameservers / Custom records**

Rough paths for the common providers (the wording moves around, so match the closest thing you see):

| Provider | Where to look |
|---|---|
| GoDaddy | My Products → find the domain → **DNS** → Manage Zones / Add Record |
| Namecheap | Domain List → **Manage** → **Advanced DNS** tab |
| Squarespace | Settings → Domains → select the domain → **DNS Settings** |
| Wix | Domains → select the domain → **Advanced** → Edit DNS / DNS Records |
| Cloudflare | Select the domain → **DNS** tab → Add record |
| Shopify | Settings → Domains → select the domain → **Domain settings** → Edit DNS |

You should end up on a page listing existing records in a table, with an **Add** or **Add Record** button.

**Do not delete or edit anything already on that page.** Only add new rows.

## Step 3 - add the portal address

Click Add Record and enter:

| Field | Value |
|---|---|
| Type | `CNAME` |
| Name / Host | `portal` |
| Value / Points to / Target | `cname.vercel-dns.com` |
| TTL | leave as the default (Auto or 3600) |

Save.

**Important:** in the Name field enter only `portal`, not `portal.taiyotuition.com`.
Most providers add the rest of the domain for you, and typing the full address produces `portal.taiyotuition.com.taiyotuition.com`, which will not work.

## Step 4 - add the three email settings

These let the portal send password-reset emails from your own domain, so they arrive properly instead of going to spam.

Add each of these as a new record, the same way:

| Type | Name / Host | Value |
|---|---|---|
| `[TYPE 1]` | `[NAME 1]` | `[VALUE 1]` |
| `[TYPE 2]` | `[NAME 2]` | `[VALUE 2]` |
| `[TYPE 3]` | `[NAME 3]` | `[VALUE 3]` |

Copy the values exactly, including any quotation marks.
They are long, so paste rather than type them.

## Step 5 - tell me it is done

Send a message once all four are saved.
Changes usually take effect within an hour, though they can take up to a day.
I will confirm from my side and you do not need to do anything else.

---

## If something looks wrong

- **"This record already exists"** - a record with that name may already be there. Do not overwrite it; send me a screenshot of the existing one instead.
- **You cannot find DNS settings** - your website provider may manage the domain on your behalf. Send me their name and I will contact them directly.
- **You would rather I did it** - add me as a user on the account, or share the login, and I will make the changes myself. I will not touch anything relating to your current website.
