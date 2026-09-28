import { decisionLog } from "@/lib/queries";

export const dynamic = "force-dynamic";

const COLS = [
  "decided_at", "name", "source_file", "role", "action", "total", "band", "flags", "note",
  "email_kind", "email_status", "final_subject", "sent_to", "sent_at", "resend_id",
] as const;

const cell = (v: unknown) => {
  const s = v == null ? "" : Array.isArray(v) ? v.join("; ") : v instanceof Date ? v.toISOString() : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  const rows = await decisionLog();
  const csv = [COLS.join(","), ...rows.map((r) => COLS.map((c) => cell(r[c])).join(","))].join("\n");
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kargo-decision-log-${stamp}.csv"`,
    },
  });
}
