/**
 * The email copy of a portal notification. It uses the same look as the
 * Supabase password email (white card, brand button) so every email from the
 * portal reads as one product.
 */

type NotificationEmailInput = {
  title: string;
  body: string | null;
  href: string | null;
  /** The portal's origin, e.g. https://portal.taiyotuition.com. */
  origin: string;
};

export type RenderedNotificationEmail = {
  subject: string;
  html: string;
  text: string;
};

const URGENT_ANNOUNCEMENT = /^urgent announcement:\s*/i;
const URGENT = /^urgent:\s*/i;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Links stay inside the portal: anything but a same-site path opens its home. */
function portalUrl(origin: string, href: string | null): string {
  const path = href && href.startsWith("/") && !href.startsWith("//") ? href : "/";
  return `${origin}${path}`;
}

function splitUrgency(title: string): { badge: string | null; heading: string; subject: string } {
  if (URGENT_ANNOUNCEMENT.test(title)) {
    return { badge: "Urgent announcement", heading: title.replace(URGENT_ANNOUNCEMENT, ""), subject: title };
  }
  if (URGENT.test(title)) {
    const heading = title.replace(URGENT, "");
    return { badge: "Urgent", heading, subject: `Urgent: ${heading}` };
  }
  return { badge: null, heading: title, subject: title };
}

export function renderNotificationEmail(input: NotificationEmailInput): RenderedNotificationEmail {
  const { badge, heading, subject } = splitUrgency(input.title.trim());
  const body = input.body?.trim() ?? "";
  const url = portalUrl(input.origin, input.href);

  const badgeHtml = badge
    ? `<p style="margin: 0 0 12px;"><span style="background: #fef3f2; border: 1px solid #fecdca; border-radius: 999px; color: #b42318; display: inline-block; font-size: 13px; font-weight: 700; letter-spacing: 0.02em; padding: 4px 10px;">${escapeHtml(badge)}</span></p>`
    : "";
  const bodyHtml = body
    ? `<p style="font-size: 16px; line-height: 1.6; margin: 0;">${escapeHtml(body).replace(/\r?\n/g, "<br />")}</p>`
    : "";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin: 0; background: #f5f7ff; color: #1d2951; font-family: Arial, Helvetica, sans-serif;">
    <div style="margin: 0 auto; max-width: 560px; padding: 32px 20px;">
      <div style="background: #ffffff; border: 1px solid #dfe4f4; border-radius: 16px; padding: 32px;">
        ${badgeHtml}
        <h1 style="font-size: 24px; line-height: 1.3; margin: 0 0 16px;">${escapeHtml(heading)}</h1>
        ${bodyHtml}
        <p style="margin: 24px 0 0;">
          <a
            href="${escapeHtml(url)}"
            style="background: #4f5bd5; border-radius: 10px; color: #ffffff; display: inline-block; font-size: 16px; font-weight: 700; padding: 14px 20px; text-decoration: none;"
          >Open in the portal</a>
        </p>
      </div>
      <p style="color: #667085; font-size: 13px; line-height: 1.6; margin: 16px 0 0; text-align: center;">Taiyo Tuition Portal</p>
    </div>
  </body>
</html>`;

  const text = [subject, body, `Open in the portal: ${url}`].filter(Boolean).join("\n\n");
  return { subject, html, text };
}
