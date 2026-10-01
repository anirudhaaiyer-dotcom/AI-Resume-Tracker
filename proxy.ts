import { NextResponse, type NextRequest } from "next/server";
import { isValidSession, SESSION_COOKIE } from "@/lib/session";

// Login gate. The dashboard shows candidate contact details and its buttons spend the
// Gemini key, so a deployed copy must never be open to anyone with the link.
// Login ID: APP_USERNAME (default "Anirude") · Password: APP_PASSWORD.
// Locally, no APP_PASSWORD = open; on Vercel it fails closed.
export async function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    return process.env.VERCEL ? new NextResponse("APP_PASSWORD is not configured", { status: 503 }) : NextResponse.next();
  }
  if (request.nextUrl.pathname === "/login") return NextResponse.next();
  if (await isValidSession(request.cookies.get(SESSION_COOKIE)?.value, password)) return NextResponse.next();

  // API routes get a plain 401; pages go to the login screen and come back afterwards.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return new NextResponse("Login required", { status: 401 });
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
