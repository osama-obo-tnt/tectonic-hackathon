import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);

function sameOrigin(origin: string | null, host: string | null) {
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // CSRF defence: state-changing requests must come from our own origin.
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (!sameOrigin(req.headers.get("origin"), req.headers.get("host"))) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }
  }

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
