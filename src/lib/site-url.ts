/**
 * Canonical application origin used in server-generated authentication links.
 *
 * Supabase only accepts redirect destinations on its allow-list, so we never
 * derive this from an incoming Host header. Production defaults to the client
 * domain; local development defaults to localhost. NEXT_PUBLIC_SITE_URL can
 * override either when a separate, explicitly configured test site is used.
 */
export function siteOrigin(
  env: Record<string, string | undefined> = process.env,
): string {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return normaliseOrigin(configured);

  if (env.VERCEL_ENV === "production") {
    return "https://portal.taiyotuition.com";
  }

  if (env.VERCEL_URL?.trim()) {
    return normaliseOrigin(`https://${env.VERCEL_URL.trim()}`);
  }

  if (env.NODE_ENV === "production") {
    return "https://portal.taiyotuition.com";
  }

  return "http://localhost:3000";
}

export function passwordSetupRedirect(
  env: Record<string, string | undefined> = process.env,
): string {
  return `${siteOrigin(env)}/auth/callback?next=/reset-password`;
}

function normaliseOrigin(value: string): string {
  const url = new URL(value);
  return url.origin;
}
