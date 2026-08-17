import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isValidSessionToken, OPERATOR_COOKIE_NAME } from "@/lib/auth";

// Next.js 16 renamed Middleware to Proxy (same file-convention slot, root-level file).
// Proxy defaults to the Node.js runtime as of v16, so lib/auth.ts's use of the `crypto`
// module works here without any Edge-runtime workarounds.
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/operator/login")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(OPERATOR_COOKIE_NAME)?.value;
  if (isValidSessionToken(token)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/operator/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/operator/:path*"],
};
