import { basename } from "node:path";
import { sql } from "./db";
import { parseCv } from "./parse";
import { redact } from "./redact";
import { bandFor, computeScore, flagsFor, suggestRole, type Role } from "./rubric";
import { levelsFor, scoreCv, type ScoredCv } from "./score";

export function roleFromFile(file: string): Role | null {
  if (/^spm_/i.test(file)) return "SPM";
  if (/^pm_/i.test(file)) return "PM";
  return null;
}

export type IngestResult =
  | { status: "skipped" | "scored"; candidateId: number; scored?: ScoredCv }
  | { status: "parse_failed"; candidateId: number; error: string };

// Parse → redact → store → score (once) → store both weightings. Never decides anything.
export async function ingest(
  path: string,
  opts: { pool: "application" | "hire"; roleTag?: Role | null; rescore?: boolean },
): Promise<IngestResult> {
  const file = basename(path);
  const roleTag = opts.roleTag === undefined ? roleFromFile(file) : opts.roleTag;

  const existing = await sql`SELECT c.id, count(s.id)::int AS n FROM candidates c
    LEFT JOIN scores s ON s.candidate_id = c.id WHERE c.source_file = ${file} GROUP BY c.id`;
  if (existing[0]?.n === 2 && !opts.rescore) return { status: "skipped", candidateId: existing[0].id };

  let text: string;
  try {
    text = await parseCv(path);
  } catch (e: any) {
    const [row] = await sql`INSERT INTO candidates (source_file, pool, role_tag, parse_failed, parse_error)
      VALUES (${file}, ${opts.pool}, ${roleTag}, TRUE, ${String(e.message)})
      ON CONFLICT (source_file) DO UPDATE SET parse_failed = TRUE, parse_error = EXCLUDED.parse_error
      RETURNING id`;
    return { status: "parse_failed", candidateId: row.id, error: String(e.message) };
  }

  const { redacted, contact } = redact(text, file);
  const [cand] = await sql`INSERT INTO candidates (source_file, pool, role_tag, name, email, phone, links, redacted_text)
    VALUES (${file}, ${opts.pool}, ${roleTag}, ${contact.name}, ${contact.email}, ${contact.phone},
            ${JSON.stringify(contact.links)}, ${redacted})
    ON CONFLICT (source_file) DO UPDATE SET role_tag = EXCLUDED.role_tag, name = EXCLUDED.name,
      email = EXCLUDED.email, phone = EXCLUDED.phone, links = EXCLUDED.links,
      redacted_text = EXCLUDED.redacted_text, parse_failed = FALSE, parse_error = NULL
    RETURNING id`;

  const scored = await scoreCv(redacted);
  if (!scored) {
    await sql`UPDATE candidates SET parse_failed = TRUE, parse_error = 'LLM returned invalid JSON twice' WHERE id = ${cand.id}`;
    return { status: "parse_failed", candidateId: cand.id, error: "LLM returned invalid JSON twice" };
  }

  const pmLevels = levelsFor(scored, "PM");
  const spmLevels = levelsFor(scored, "SPM");
  const pmScore = computeScore(pmLevels, "PM");
  const spmScore = computeScore(spmLevels, "SPM");

  for (const [weighting, levels, total] of [
    ["PM", pmLevels, pmScore],
    ["SPM", spmLevels, spmScore],
  ] as const) {
    const flags = flagsFor({ role: weighting, levels, years: scored.years, pmScore, spmScore });
    const evidence = { ...scored.evidence, E: scored.evidence[weighting === "PM" ? "E_PM" : "E_SPM"] };
    await sql`INSERT INTO scores (candidate_id, weighting, levels, evidence, total, band, flags, years_pm, why_ranked_here, probes, model)
      VALUES (${cand.id}, ${weighting}, ${JSON.stringify(levels)}, ${JSON.stringify(evidence)}, ${total},
              ${bandFor(total).label}, ${flags}, ${scored.years}, ${scored.why}, ${JSON.stringify(scored.probes)}, ${scored.model})
      ON CONFLICT (candidate_id, weighting) DO UPDATE SET levels = EXCLUDED.levels, evidence = EXCLUDED.evidence,
        total = EXCLUDED.total, band = EXCLUDED.band, flags = EXCLUDED.flags, years_pm = EXCLUDED.years_pm,
        why_ranked_here = EXCLUDED.why_ranked_here, probes = EXCLUDED.probes, model = EXCLUDED.model, scored_at = now()`;
  }

  if (!roleTag) {
    await sql`UPDATE candidates SET role_suggested = ${suggestRole(scored.years)} WHERE id = ${cand.id}`;
  }
  return { status: "scored", candidateId: cand.id, scored };
}
