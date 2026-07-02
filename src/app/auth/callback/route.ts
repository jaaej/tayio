import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Open-redirect guard: allow only same-origin absolute paths. Reject
  // protocol-relative ("//host") / backslash ("/\host") forms and control
  // chars that would resolve to another origin.
  const safeNext =
    /^\/[^/\\]/.test(next) && !/[\x00-\x1f\x7f]/.test(next) ? next : "/";
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
