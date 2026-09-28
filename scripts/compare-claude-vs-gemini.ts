import "./_env";
import { sql } from "../lib/db";
import { computeScore, bandFor, type Role } from "../lib/rubric";
// Independent blind scoring by the kargo-ats agent (Claude), read via Chrome. Role = tag, or suggested for untagged.
const MINE: Record<string, { role: Role; L: number[] }> = {
  "pm_01_priya_krishnan.pdf":   { role: "PM",  L: [3, 4, 4, 3, 4, 2] },
  "pm_08_nishant_joshi.pdf":    { role: "PM",  L: [1, 2, 2, 1, 3, 0] },
  "pm_15_tanvi_jain.pdf":       { role: "PM",  L: [0, 2, 1, 1, 1, 0] },
  "spm_16_siddharth_rao.pdf":   { role: "SPM", L: [4, 4, 4, 3, 3, 3] },
  "spm_23_preethi_suresh.pdf":  { role: "SPM", L: [1, 2, 4, 3, 2, 2] },
  "spm_30_priya_iyer.pdf":      { role: "SPM", L: [0, 0, 2, 0, 2, 0] },
  "14_sneha_kulkarni.pdf":      { role: "PM",  L: [1, 2, 3, 2, 3, 0] },
  "21_aryan_kulkarni.pdf":      { role: "PM",  L: [1, 2, 3, 2, 3, 0] },
  "03_arnav_sen.pdf":           { role: "SPM", L: [1, 2, 3, 1, 3, 1] },
  "27_abhishek_tiwari.pdf":     { role: "SPM", L: [0, 2, 2, 1, 3, 0] },
};
const C = ["A", "B", "C", "D", "E", "F"] as const;
let agree = 0, within1 = 0, total = 0, sameBand = 0;
console.log("CV                          role  Claude(ATS)        Gemini             Δlevels        Claude  Gemini  band match");
for (const [file, m] of Object.entries(MINE)) {
  const [s] = await sql`SELECT s.levels, s.total::float t, s.band, s.flags, c.role_suggested FROM candidates c JOIN scores s ON s.candidate_id=c.id WHERE c.source_file=${file} AND s.weighting=${m.role}`;
  const g = C.map((c) => s.levels[c]);
  const mine = Object.fromEntries(C.map((c, i) => [c, m.L[i]])) as any;
  const myT = computeScore(mine, m.role);
  const d = g.map((x, i) => x - m.L[i]);
  d.forEach((x) => { total++; if (x === 0) agree++; if (Math.abs(x) <= 1) within1++; });
  const bm = bandFor(myT).label === s.band; if (bm) sameBand++;
  console.log(`${file.padEnd(28)}${m.role.padEnd(6)}${m.L.join(" ").padEnd(19)}${g.join(" ").padEnd(19)}${d.map((x) => (x > 0 ? "+" : "") + x).join(" ").padEnd(15)}${myT.toFixed(2).padStart(6)}  ${s.t.toFixed(2).padStart(6)}  ${bm ? "yes" : "NO"} (${s.band})${s.flags.length ? " flags:" + s.flags.join(",") : ""}${s.role_suggested ? " suggested:" + s.role_suggested : ""}`);
}
console.log(`\nLevel agreement: exact ${agree}/${total} (${Math.round((100 * agree) / total)}%), within ±1 ${within1}/${total} (${Math.round((100 * within1) / total)}%), same band ${sameBand}/10`);
const pair = await sql`SELECT c.source_file, s.levels FROM candidates c JOIN scores s ON s.candidate_id=c.id AND s.weighting='PM' WHERE c.source_file IN ('14_sneha_kulkarni.pdf','21_aryan_kulkarni.pdf')`;
console.log("Blind check (identical CVs):", pair.map((p) => `${p.source_file}=${C.map((c) => p.levels[c]).join("")}`).join(" vs "));
