import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { UserRole } from "@/db/schema";

const ROLE_HOME: Record<UserRole, string> = {
  student: "/student",
  parent: "/parent",
  tutor: "/tutor",
  admin: "/admin",
};

const ROLE_PREFIXES = Object.values(ROLE_HOME);

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isRoleRoute = ROLE_PREFIXES.some((p) => pathname.startsWith(p));

  if (!user && isRoleRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isRoleRoute) {
    // app_metadata only — user_metadata is user-mutable and must not gate access.
    const role = user.app_metadata?.role as UserRole | undefined;
    if (role) {
      const allowedPrefix = ROLE_HOME[role];
      if (!pathname.startsWith(allowedPrefix)) {
        const url = request.nextUrl.clone();
        url.pathname = allowedPrefix;
        return NextResponse.redirect(url);
      }
    }
  }

  if (user && isAuthRoute) {
    // app_metadata only — user_metadata is user-mutable and must not gate access.
    const role = user.app_metadata?.role as UserRole | undefined;
    const url = request.nextUrl.clone();
    url.pathname = role ? ROLE_HOME[role] : "/";
    return NextResponse.redirect(url);
  }

  return response;
}
