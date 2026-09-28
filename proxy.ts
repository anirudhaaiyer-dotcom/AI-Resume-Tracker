import { NextResponse, type NextRequest } from "next/server";

// Shared-password gate (HTTP Basic Auth). The dashboard shows candidate contact details and
// its buttons spend the Gemini key, so a deployed copy must never be open to anyone with the link.
// Username: kargo · Password: APP_PASSWORD. Locally, no APP_PASSWORD = open; on Vercel it fails closed.
export function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    return process.env.VERCEL ? new NextResponse("APP_PASSWORD is not configured", { status: 503 }) : NextResponse.next();
  }
  const header = request.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const [user, pass] = atob(encoded).split(":");
    if (user === "kargo" && pass === password) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Kargo Hiring", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
