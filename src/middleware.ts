import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

export async function middleware(request: NextRequest) {
  const authRes = await auth0.middleware(request);

  // Let Auth0's own routes through always
  if (request.nextUrl.pathname.startsWith("/auth")) {
    return authRes;
  }

  // Public routes — add any others your app has
  const publicRoutes = ["/", "/login", "/register", "/complete-profile"];
  if (publicRoutes.includes(request.nextUrl.pathname)) {
    return authRes;
  }

  // Everything else (e.g. /dashboard) requires login
  const session = await auth0.getSession(request);
  if (!session) {
    return NextResponse.redirect(`${new URL(request.url).origin}/auth/login`);
  }

  return authRes;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/).*)"],
};