import { sql } from "./db";
import type { Role } from "./rubric";

export type Row = Record<string, any>;

// Effective role: Arjun's confirmation wins, then the filename/upload tag, then the suggestion.
const ROLE = `coalesce(c.role_confirmed, c.role_tag, c.role_suggested)`;

export async function rankedList(role: Role): Promise<Row[]> {
  return sql.query(
    `SELECT c.id, c.name, c.source_file, c.role_tag, c.role_suggested, c.role_confirmed, c.parse_failed,
            s.total::float AS total, s.band, s.flags, s.why_ranked_here, s.levels,
            d.action AS decision, d.decided_at,
            e.status AS email_status
     FROM candidates c
     LEFT JOIN scores s ON s.candidate_id = c.id AND s.weighting = $1
     LEFT JOIN LATERAL (SELECT id, action, decided_at FROM decisions WHERE candidate_id = c.id ORDER BY decided_at DESC LIMIT 1) d ON TRUE
     LEFT JOIN LATERAL (SELECT status FROM emails WHERE decision_id = d.id ORDER BY created_at DESC LIMIT 1) e ON TRUE
     WHERE c.pool = 'application' AND (${ROLE} = $1 OR (c.parse_failed AND c.role_tag IS NULL))
     ORDER BY c.parse_failed DESC, s.total DESC NULLS LAST, c.id`,
    [role],
  );
}

export async function roleCounts(): Promise<Record<string, { total: number; undecided: number }>> {
  const rows = await sql.query(
    `SELECT ${ROLE} AS role, count(*)::int AS total,
            count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM decisions d WHERE d.candidate_id = c.id))::int AS undecided
     FROM candidates c WHERE c.pool = 'application' GROUP BY 1`,
  );
  return Object.fromEntries(rows.map((r: Row) => [r.role, { total: r.total, undecided: r.undecided }]));
}

export async function candidate(id: number) {
  const [c] = await sql`SELECT *, coalesce(role_confirmed, role_tag, role_suggested) AS role FROM candidates WHERE id = ${id}`;
  if (!c) return null;
  const scores = await sql`SELECT *, total::float AS total, years_pm::float AS years_pm FROM scores WHERE candidate_id = ${id}`;
  const decisions = await sql`SELECT * FROM decisions WHERE candidate_id = ${id} ORDER BY decided_at DESC`;
  const emails = await sql`SELECT e.* FROM emails e JOIN decisions d ON d.id = e.decision_id
                           WHERE d.candidate_id = ${id} ORDER BY e.created_at DESC`;
  return { c, scores, decisions, emails };
}

export async function decisionLog(): Promise<Row[]> {
  return sql`
    SELECT d.id, d.decided_at, d.action, d.role, d.note,
           c.id AS candidate_id, c.name, c.source_file,
           s.total::float AS total, s.band, s.flags,
           e.kind AS email_kind, e.status AS email_status, e.sent_to, e.sent_at, e.resend_id, e.final_subject
    FROM decisions d
    JOIN candidates c ON c.id = d.candidate_id
    LEFT JOIN scores s ON s.candidate_id = c.id AND s.weighting = coalesce(d.role, c.role_confirmed, c.role_tag, c.role_suggested)
    LEFT JOIN LATERAL (SELECT * FROM emails WHERE decision_id = d.id ORDER BY created_at DESC LIMIT 1) e ON TRUE
    ORDER BY d.decided_at DESC`;
}
