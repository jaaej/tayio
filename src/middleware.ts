import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { buildCsp } from "@/lib/security-headers";

export async function middleware(request: NextRequest) {
  // Per-request nonce → CSP. Forwarded on the request header so Next.js stamps
  // its inline scripts with it; also set on the response (in updateSession).
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = btoa(String.fromCharCode(...bytes));
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  return await updateSession(request, requestHeaders, csp);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
