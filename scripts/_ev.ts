import "./_env";
import { sql } from "../lib/db";
const rows = await sql`SELECT c.source_file, s.evidence, s.why_ranked_here FROM candidates c JOIN scores s ON s.candidate_id=c.id AND s.weighting='PM' WHERE c.source_file = ANY(${process.argv.slice(2)})`;
for (const r of rows) { console.log("=====", r.source_file); for (const k of ["A","B","C","D","E","F"]) { const v = r.evidence[k]; console.log(`${k}=${v.level}${v.verified?"":" (DROPPED)"}: ${v.quote ?? v.dropped_quote ?? "-"}`); } console.log("why:", r.why_ranked_here); }
