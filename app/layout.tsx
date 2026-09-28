import type { Metadata } from "next";
import Link from "next/link";
import { roleCounts } from "@/lib/queries";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kargo Hiring",
  description: "PM and Senior PM screening for Kargo — the system recommends, Arjun decides.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
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
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
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
            <p className="ml-auto hidden text-xs text-muted md:block">
              The system recommends. You decide. Nothing is sent until you click Send.
            </p>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
