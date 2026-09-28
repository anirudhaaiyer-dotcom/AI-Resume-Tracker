"use server";

import { writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { draftEmail, sendViaResend, type EmailKind } from "@/lib/email";
import { ingest } from "@/lib/pipeline";
import type { Role } from "@/lib/rubric";

const firstName = (name: string | null) => (name ?? "").split(" ")[0] ?? "";

// Arjun's click is the only thing that creates a decision. A decision drafts an email;
// it never sends one.
export async function decide(formData: FormData) {
  const id = Number(formData.get("candidateId"));
  const action = String(formData.get("action")) as "advance" | "pass" | "consider_for_pm";
  const role = String(formData.get("role")) as Role;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (action === "consider_for_pm") {
    await sql`INSERT INTO decisions (candidate_id, action, role, note) VALUES (${id}, 'consider_for_pm', 'SPM', ${note})`;
    await sql`UPDATE candidates SET role_confirmed = 'PM' WHERE id = ${id}`;
    revalidatePath("/", "layout");
    redirect(`/candidate/${id}`);
  }

  const [d] = await sql`INSERT INTO decisions (candidate_id, action, role, note)
                        VALUES (${id}, ${action}, ${role}, ${note}) RETURNING id`;
  await createDraft(id, d.id, action === "advance" ? "invite" : "rejection", role);
  revalidatePath("/", "layout");
  redirect(`/candidate/${id}#email`);
}

async function createDraft(candidateId: number, decisionId: number, kind: EmailKind, role: Role) {
  const [c] = await sql`SELECT name FROM candidates WHERE id = ${candidateId}`;
  const [s] = await sql`SELECT evidence FROM scores WHERE candidate_id = ${candidateId} AND weighting = ${role}`;
  // Strongest verified evidence first — the invite must reference one real thing from the CV.
  const facts = Object.values((s?.evidence ?? {}) as Record<string, { level: number; quote: string | null }>)
    .filter((e) => e.quote && e.level >= 2)
    .sort((a, b) => b.level - a.level)
    .map((e) => e.quote!)
    .filter((q, i, arr) => arr.indexOf(q) === i)
    .slice(0, 3);
  try {
    const draft = await draftEmail({ kind, role, facts, firstName: firstName(c?.name) });
    await sql`INSERT INTO emails (decision_id, kind, draft_subject, draft_body, final_subject, final_body)
              VALUES (${decisionId}, ${kind}, ${draft.subject}, ${draft.body}, ${draft.subject}, ${draft.body})`;
  } catch (e: any) {
    await sql`INSERT INTO emails (decision_id, kind, status, error)
              VALUES (${decisionId}, ${kind}, 'failed', ${"Draft failed: " + String(e?.message ?? e).slice(0, 300)})`;
  }
}

export async function redraft(formData: FormData) {
  const emailId = Number(formData.get("emailId"));
  const [e] = await sql`SELECT e.kind, e.decision_id, d.candidate_id, d.role FROM emails e JOIN decisions d ON d.id = e.decision_id
                        WHERE e.id = ${emailId} AND e.status IN ('draft', 'failed')`;
  if (!e) return;
  await sql`DELETE FROM emails WHERE id = ${emailId}`;
  await createDraft(e.candidate_id, e.decision_id, e.kind, e.role);
  revalidatePath(`/candidate/${e.candidate_id}`);
}

// One click → one send. The row is claimed ('draft' → 'sending') atomically first.
export async function sendEmail(formData: FormData) {
  const emailId = Number(formData.get("emailId"));
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const [claimed] = await sql`UPDATE emails SET status = 'sending', final_subject = ${subject}, final_body = ${body}
                              WHERE id = ${emailId} AND status = 'draft' RETURNING decision_id`;
  if (!claimed) return;
  const [c] = await sql`SELECT c.id, c.name, c.email FROM candidates c JOIN decisions d ON d.candidate_id = c.id
                        WHERE d.id = ${claimed.decision_id}`;
  try {
    const sent = await sendViaResend({ subject, body, intendedName: c.name, intendedEmail: c.email });
    await sql`UPDATE emails SET status = 'sent', sent_to = ${sent.to}, resend_id = ${sent.id}, sent_at = now(), error = NULL
              WHERE id = ${emailId}`;
  } catch (e: any) {
    // Back to draft so Arjun can fix the problem (e.g. missing key) and click again.
    await sql`UPDATE emails SET status = 'draft', error = ${String(e?.message ?? e).slice(0, 300)} WHERE id = ${emailId}`;
  }
  revalidatePath("/", "layout");
}

export async function confirmRole(formData: FormData) {
  const id = Number(formData.get("candidateId"));
  const role = String(formData.get("role")) as Role;
  await sql`UPDATE candidates SET role_confirmed = ${role} WHERE id = ${id}`;
  revalidatePath("/", "layout");
}

// Upload: saved into data/applications (gitignored), then parsed → redacted → scored.
export async function uploadCvs(formData: FormData) {
  const role = String(formData.get("role")) as Role;
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const results: { file: string; status: string; id?: number }[] = [];
  for (const f of files) {
    const name = basename(f.name).replace(/[^\w.\-]/g, "_");
    if (!/\.(pdf|docx|txt)$/i.test(name)) {
      results.push({ file: name, status: "unsupported type" });
      continue;
    }
    const path = join(process.cwd(), "data", "applications", name);
    await writeFile(path, Buffer.from(await f.arrayBuffer()));
    try {
      const r = await ingest(path, { pool: "application", roleTag: role, rescore: true });
      results.push({ file: name, status: r.status, id: r.candidateId });
    } catch (e: any) {
      results.push({ file: name, status: `error: ${String(e?.message ?? e).slice(0, 120)}` });
    }
  }
  revalidatePath("/", "layout");
  const q = encodeURIComponent(JSON.stringify(results));
  redirect(`/upload?done=${q}`);
}
