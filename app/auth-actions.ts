"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, loginUsername, SESSION_COOKIE } from "@/lib/session";

// Only same-site paths, so the login page can't be used to bounce people to another site.
const safeNext = (next: string) => (next.startsWith("/") && !next.startsWith("//") ? next : "/");

export async function login(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/"));
  const expected = process.env.APP_PASSWORD;

  if (!expected || id !== loginUsername() || password !== expected) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }
  const session = await createSession(expected);
  (await cookies()).set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expires,
  });
  redirect(next);
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
