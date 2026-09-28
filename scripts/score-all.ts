// Score every CV in data/applications (sequential — Gemini free tier is rate-limited).
// Already-scored files are skipped unless --rescore. Usage: npx tsx scripts/score-all.ts [--rescore] [--limit N]
import "./_env";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { ingest } from "../lib/pipeline";
import { usage } from "../lib/score";

const rescore = process.argv.includes("--rescore");
const limitArg = process.argv.indexOf("--limit");
const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

const dir = "data/applications";
const files = readdirSync(dir).filter((f) => /\.(pdf|docx|txt)$/i.test(f)).sort().slice(0, limit);
const tally = { scored: 0, skipped: 0, parse_failed: 0, error: 0 };

for (const [i, file] of files.entries()) {
  try {
    const r = await ingest(join(dir, file), { pool: "application", rescore });
    tally[r.status]++;
    const extra = r.status === "parse_failed" ? ` — ${r.error}` : "";
    console.log(`[${i + 1}/${files.length}] ${r.status.padEnd(12)} ${file}${extra}`);
  } catch (e: any) {
    // Provider outage / rate limit: leave unscored, a re-run picks it up.
    tally.error++;
    console.log(`[${i + 1}/${files.length}] ${"error".padEnd(12)} ${file} — ${e?.status ?? ""} ${String(e?.message ?? e).slice(0, 120)}`);
    if (/DAILY quota/.test(String(e?.message))) break;
  }
}
console.log("\n", tally);
console.log(`Gemini usage this run: ${usage.calls} calls, ${usage.input} input tokens, ${usage.output} output tokens (incl. thinking)`);
