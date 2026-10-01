import Link from "next/link";
import { decisionLog } from "@/lib/queries";
import { Band } from "@/app/ui";

const ACTION: Record<string, string> = { advance: "Advance", pass: "Pass", consider_for_pm: "Consider for PM" };

export default async function LogPage() {
  const rows = await decisionLog();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">Decision log</h1>
        <a href="/api/log" className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-quote">
          Export CSV
        </a>
      </div>
      <p className="text-sm text-muted">
        Every decision you made, the score it was made against, and what was sent. This is the record of why.
      </p>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-line bg-panel p-6 text-sm text-muted">No decisions yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-panel">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Candidate</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Decision</th>
                <th className="px-3 py-2 text-right font-medium">Score</th>
                <th className="px-3 py-2 font-medium">Band</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line align-top last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{new Date(r.decided_at).toLocaleString("en-IN")}</td>
                  <td className="px-3 py-2">
                    <Link href={`/candidate/${r.candidate_id}`} className="hover:underline">
                      {r.name || r.source_file}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.role}</td>
                  <td className="px-3 py-2">{ACTION[r.action] ?? r.action}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.total?.toFixed(1) ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Band band={r.band} />
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.email_kind ? (
                      <>
                        {r.email_kind} · {r.email_status}
                        {r.sent_at && (
                          <div className="text-muted">
                            {new Date(r.sent_at).toLocaleString("en-IN")} → {r.sent_to}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
