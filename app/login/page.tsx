import type { Metadata } from "next";
import { login } from "@/app/auth-actions";
import { Submit } from "@/app/(app)/candidate/[id]/buttons";

export const metadata: Metadata = { title: "Log in · Kargo Hiring" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Kargo <span className="font-normal text-muted">· Hiring</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Product Manager and Senior PM screening</p>
        </div>

        <form action={login} className="space-y-4 rounded-lg border border-line bg-panel p-6">
          <input type="hidden" name="next" value={next ?? "/"} />
          <label className="block space-y-1">
            <span className="text-sm font-medium">Login ID</span>
            <input
              name="id"
              autoComplete="username"
              required
              autoFocus
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
            />
          </label>
          {error && <p className="text-sm text-danger">That login ID and password don't match.</p>}
          <div className="pt-1">
            <Submit pendingText="Logging in…">Log in</Submit>
          </div>
        </form>

        <p className="text-center text-xs text-muted">
          The system recommends. You decide. Nothing is sent until you click Send.
        </p>
      </div>
    </main>
  );
}
