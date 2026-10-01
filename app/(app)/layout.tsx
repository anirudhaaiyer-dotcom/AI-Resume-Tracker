import Link from "next/link";
import { logout } from "@/app/auth-actions";
import { roleCounts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const counts = await roleCounts();
  const tab = (href: string, label: string, n?: { total: number; undecided: number }) => (
    <Link href={href} className="rounded-md px-3 py-1.5 text-sm hover:bg-quote">
      {label}
      {n && (
        <span className="ml-1.5 text-xs text-muted">
          {n.undecided}/{n.total}
        </span>
      )}
    </Link>
  );
  return (
    <>
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="font-semibold tracking-tight">
            Kargo <span className="font-normal text-muted">· Hiring</span>
          </Link>
          <nav className="flex flex-wrap gap-1">
            {tab("/role/PM", "Product Manager", counts.PM)}
            {tab("/role/SPM", "Senior PM", counts.SPM)}
            {tab("/log", "Decision log")}
            {tab("/upload", "Upload CVs")}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <p className="hidden text-xs text-muted lg:block">
              The system recommends. You decide. Nothing is sent until you click Send.
            </p>
            {process.env.APP_PASSWORD && (
              <form action={logout}>
                <button type="submit" className="rounded-md border border-line px-2.5 py-1 text-xs text-muted hover:bg-quote">
                  Log out
                </button>
              </form>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
