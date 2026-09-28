// Score every CV in data/applications (sequential — Gemini free tier is rate-limited).
// Already-scored files are skipped unless --rescore. Usage: npx tsx scripts/score-all.ts [--rescore] [--limit N]
import "./_env";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { ingest } from "../lib/pipeline";

const rescore = process.argv.includes("--rescore");
const limitArg = process.argv.indexOf("--limit");
const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

const dir = "data/applications";
const files = readdirSync(dir).filter((f) => /\.(pdf|docx|txt)$/i.test(f)).sort().slice(0, limit);
const tally = { scored: 0, skipped: 0, parse_failed: 0 };

for (const [i, file] of files.entries()) {
  const r = await ingest(join(dir, file), { pool: "application", rescore });
  tally[r.status]++;
  const extra = r.status === "parse_failed" ? ` — ${r.error}` : "";
  console.log(`[${i + 1}/${files.length}] ${r.status.padEnd(12)} ${file}${extra}`);
}
console.log("\n", tally);
