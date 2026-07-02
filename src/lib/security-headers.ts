// Content-Security-Policy builder. Called from middleware with a per-request
// nonce so Next.js can stamp its inline bootstrap/hydration scripts with the
// nonce (it reads the CSP from the forwarded request header). This is what lets
// prod drop 'unsafe-inline' for scripts and get real XSS protection.
//
// Dev stays permissive ('unsafe-inline' + 'unsafe-eval', no nonce) because HMR
// and React Refresh inject un-nonced inline scripts and use eval.

export function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";

  let supabaseOrigin = "";
  try {
    supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    supabaseOrigin = "";
  }
  const supabaseWs = supabaseOrigin.replace(/^https/, "wss");

  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;

  return [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),
    `media-src 'self' blob: ${supabaseOrigin}`.trim(),
    `font-src 'self'`,
    `style-src 'self' 'unsafe-inline'`,
    scriptSrc,
    `connect-src 'self' ${supabaseOrigin} ${supabaseWs}${isDev ? " ws:" : ""}`.trim(),
    `frame-src 'self'`,
    `worker-src 'self' blob:`,
    ...(isDev ? [] : [`upgrade-insecure-requests`]),
  ]
    .filter(Boolean)
    .join("; ");
}
