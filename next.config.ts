import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Supabase origin (auth, storage, realtime) is derived from env so the policy
// works across dev/prod projects without hardcoding.
let supabaseOrigin = "";
try {
  supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
} catch {
  supabaseOrigin = "";
}
const supabaseWs = supabaseOrigin.replace(/^https/, "wss");

// Video hosts we embed lesson recordings from (link-based recorded lessons).
// Kept to the specific player origins so frame-src stays tight; any other host
// falls back to a plain "Watch recording" link, no framing involved.
const videoFrameSrc =
  "https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com";

// NOTE: script-src still allows 'unsafe-inline' because Next.js injects inline
// bootstrap/hydration scripts. Turning that into real XSS protection requires a
// per-request nonce (middleware-generated) - tracked as the follow-up. Every
// other directive is locked down. style-src needs 'unsafe-inline' for the
// inline style={{...}} attributes used throughout the UI.
const csp = [
  `default-src 'self'`,
  `base-uri 'self'`,
  `object-src 'none'`,
  `frame-ancestors 'none'`,
  `form-action 'self'`,
  `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),
  `media-src 'self' blob: ${supabaseOrigin}`.trim(),
  `font-src 'self'`,
  `style-src 'self' 'unsafe-inline'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}${isDev ? " ws:" : ""}`.trim(),
  `frame-src 'self' ${videoFrameSrc}`,
  `worker-src 'self' blob:`,
  // Only force HTTPS upgrades in production; localhost dev is http.
  ...(isDev ? [] : [`upgrade-insecure-requests`]),
]
  .filter(Boolean)
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  // Discussion attachments (up to 3 × 10 MB) are submitted through Server
  // Actions, so the default 1 MB body cap must be raised.
  experimental: {
    serverActions: {
      bodySizeLimit: "32mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
