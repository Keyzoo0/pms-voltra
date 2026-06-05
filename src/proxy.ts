import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSessionToken } from "@/lib/auth";

// Next.js 16 renamed the "middleware" convention to "proxy".
export async function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const valid = (await readSessionToken(token)) !== null;
  const { pathname } = req.nextUrl;
  const isLogin = pathname === "/login";

  if (!valid && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search =
      pathname && pathname !== "/" ? `?from=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(url);
  }

  if (valid && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protect everything except API routes, Next internals and static assets.
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
