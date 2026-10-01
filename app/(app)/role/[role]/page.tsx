import Link from "next/link";
import { notFound } from "next/navigation";
import { rankedList } from "@/lib/queries";
import type { Role } from "@/lib/rubric";
import { Band, Flags, Status } from "@/app/ui";

const TITLE: Record<Role, string> = { PM: "Product Manager", SPM: "Senior Product Manager" };

export default async function RolePage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (role !== "PM" && role !== "SPM") notFound();
  const rows = await rankedList(role);
  const undecided = rows.filter((r) => !r.decision).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">{TITLE[role]}</h1>
        <p className="text-sm text-muted">
          {rows.length} candidates · {undecided} awaiting your decision · ranked by pattern score ({role} weights)
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Candidate</th>
              <th className="px-3 py-2 text-right font-medium">Score</th>
              <th className="px-3 py-2 font-medium">Band</th>
              <th className="px-3 py-2 font-medium">Why ranked here</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-b border-line align-top last:border-0 hover:bg-quote">
                <td className="px-3 py-3 text-muted">{r.parse_failed ? "!" : i + 1}</td>
                <td className="px-3 py-3">
                  <Link href={`/candidate/${r.id}`} className="font-medium hover:underline">
                    {r.name || r.source_file}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {!r.role_tag && !r.role_confirmed && (
                      <span className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted">
                        role suggested — confirm
                      </span>
                    )}
                    {r.parse_failed && (
                      <span className="rounded border border-danger px-1.5 py-0.5 text-[11px] text-danger">
                        CV unreadable — review manually
                      </span>
                    )}
                    <Flags flags={r.flags} />
                  </div>
                </td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">
                  {r.total == null ? "—" : r.total.toFixed(1)}
                </td>
                <td className="px-3 py-3">
                  <Band band={r.band} />
                </td>
                <td className="max-w-md px-3 py-3 text-muted">
                  <span className="line-clamp-2">{r.why_ranked_here}</span>
                </td>
                <td className="px-3 py-3">
                  <Status decision={r.decision} emailStatus={r.email_status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Bands order this list. They never send anything — every email waits for your click.
      </p>
    </div>
  );
}
