// Phase 3 report: top 10 per role, blind-scoring pair check, shortlist rate by college tier.
// Usage: npx tsx scripts/report.ts
import "./_env";
import { readFileSync } from "node:fs";
import { sql } from "../lib/db";

const rows = await sql`
  SELECT c.source_file, c.name, coalesce(c.role_confirmed, c.role_tag, c.role_suggested) AS role, c.role_tag,
         s.total::float AS total, s.band, s.flags, s.why_ranked_here, s.levels
  FROM candidates c JOIN scores s ON s.candidate_id = c.id
   AND s.weighting = coalesce(c.role_confirmed, c.role_tag, c.role_suggested)
  WHERE c.pool = 'application' ORDER BY s.total DESC`;

for (const role of ["PM", "SPM"]) {
  const r = rows.filter((x) => x.role === role);
  console.log(`\n=== ${role}: ${r.length} candidates — top 10`);
  r.slice(0, 10).forEach((x, i) =>
    console.log(`${String(i + 1).padStart(2)}. ${x.total.toFixed(2).padStart(6)}  ${x.band.padEnd(21)} ${(x.name ?? "").padEnd(20)} ${x.role_tag ? "" : "(untagged) "}${x.flags.length ? "[" + x.flags.join(",") + "] " : ""}\n      ${x.why_ranked_here.split(/(?<=\.)\s/)[0].slice(0, 170)}`),
  );
  const bands = r.reduce((m: any, x) => ((m[x.band] = (m[x.band] ?? 0) + 1), m), {});
  console.log("   bands:", JSON.stringify(bands));
}

// Blind check — same CV, different name.
const pair = await sql`SELECT c.source_file, s.weighting, s.total::float t, s.levels FROM candidates c JOIN scores s ON s.candidate_id=c.id
  WHERE c.source_file IN ('14_sneha_kulkarni.pdf','21_aryan_kulkarni.pdf') ORDER BY s.weighting, c.source_file`;
console.log("\n=== Blind check (identical CVs)");
for (const p of pair) console.log(`${p.weighting} ${p.source_file.padEnd(24)} ${p.t.toFixed(2).padStart(6)}  ${"ABCDEF".split("").map((k) => p.levels[k]).join("")}`);

// College tier from the ORIGINAL text (the scorer never saw it).
const T1 = /\b(IIT|IIM|ISB|XLRI|BITS|NIT|IIIT|IISc|FMS|SPJIMR|JBIMS|Jamnalal Bajaj|MDI|IIFT|NMIMS|VJTI|Indian Institute of (Technology|Management))\b/;
const tierOf = (f: string) => (T1.test(readFileSync(`data/_text/${f.replace(/\.pdf$/, ".txt")}`, "utf8")) ? "Tier 1" : "Other");
const byTier: Record<string, { n: number; short: number; sum: number }> = {};
for (const x of rows) {
  const t = tierOf(x.source_file);
  byTier[t] ??= { n: 0, short: 0, sum: 0 };
  byTier[t].n++;
  byTier[t].sum += x.total;
  if (x.total >= 55) byTier[t].short++;
}
console.log("\n=== Shortlist (Strong or Partial, ≥55) by college tier — tier read from raw CV, never shown to the scorer");
for (const [t, v] of Object.entries(byTier))
  console.log(`${t.padEnd(7)} n=${String(v.n).padStart(2)}  shortlisted=${String(v.short).padStart(2)} (${Math.round((100 * v.short) / v.n)}%)  mean score=${(v.sum / v.n).toFixed(1)}`);
console.log(`\nScored: ${rows.length} of 60`);
