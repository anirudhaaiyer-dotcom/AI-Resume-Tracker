// Score the 8 past hires (PM weights) and compare with CLAUDE.md §3.
// Pass: every Operator ≥ 75, every Spec < 55. Usage: npx tsx scripts/calibrate.ts [--rescore]
import "./_env";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { sql } from "../lib/db";
import { ingest } from "../lib/pipeline";
import { usage } from "../lib/score";

const EXPECTED: Record<string, { group: "Operator" | "Spec"; total: number }> = {
  "cv_07_lavanya_iyer.docx": { group: "Operator", total: 97.5 },
  "cv_01_rohan_desai.docx": { group: "Operator", total: 86.25 },
  "cv_02_sunita_krishnamurthy.docx": { group: "Operator", total: 85 },
  "cv_04_aditya_shetty.docx": { group: "Operator", total: 81.25 },
  "cv_06_meghna_tiwari.docx": { group: "Operator", total: 80 },
  "cv_05_preetham_rao.docx": { group: "Spec", total: 47.5 },
  "cv_08_rahul_bose.docx": { group: "Spec", total: 40 },
  "cv_03_vikram_nair.docx": { group: "Spec", total: 36.25 },
};

const rescore = process.argv.includes("--rescore");
const dir = "data/hires";
for (const file of readdirSync(dir).filter((f) => f.endsWith(".docx")).sort()) {
  try {
    const r = await ingest(join(dir, file), { pool: "hire", roleTag: "PM", rescore });
    console.log(`${r.status.padEnd(12)} ${file}`);
  } catch (e: any) {
    // Provider outage / rate limit: leave unscored, a re-run picks it up.
    console.log(`${"error".padEnd(12)} ${file} — ${e?.status ?? ""} ${String(e?.message ?? e).slice(0, 120)}`);
    if (/DAILY quota/.test(String(e?.message))) break;
  }
}

const rows = await sql`SELECT c.source_file, s.levels, s.evidence, s.total::float AS total, s.band
  FROM candidates c JOIN scores s ON s.candidate_id = c.id AND s.weighting = 'PM'
  WHERE c.pool = 'hire' ORDER BY s.total DESC`;

let pass = true;
console.log("\nHire                              Group     Expected  Got     Δ       A B C D E F  Result");
for (const r of rows) {
  const exp = EXPECTED[r.source_file];
  if (!exp) continue;
  const ok = exp.group === "Operator" ? r.total >= 75 : r.total < 55;
  pass &&= ok;
  const lv = ["A", "B", "C", "D", "E", "F"].map((c) => r.levels[c]).join(" ");
  const dropped = Object.entries(r.evidence as Record<string, any>).filter(([, v]) => v.verified === false).map(([k]) => k);
  console.log(
    `${r.source_file.padEnd(34)}${exp.group.padEnd(10)}${String(exp.total).padEnd(10)}${r.total.toFixed(2).padEnd(8)}${(r.total - exp.total).toFixed(2).padStart(6)}  ${lv}  ${ok ? "PASS" : "FAIL"}${dropped.length ? `  (quote not found → 0: ${dropped.join(",")})` : ""}`,
  );
}
console.log(`\nCalibration: ${pass ? "PASS" : "FAIL"} (Operators ≥ 75, Spec < 55)`);
console.log(`Gemini usage this run: ${usage.calls} calls, ${usage.input} input tokens, ${usage.output} output tokens (incl. thinking)`);
