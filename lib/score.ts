import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { anchorsText, type Criterion, type Levels, type Role } from "./rubric";
import { quoteInText } from "./parse";

const KEYS = ["A", "B", "C", "D", "E_PM", "E_SPM", "F"] as const;
type Key = (typeof KEYS)[number];

// The model lists every candidate quote per criterion first; code keeps the highest
// level whose quote verifies. This stops the model settling on the first plausible bullet.
// One call covers E for both roles, so PM and SPM weightings come from the same judgment.
export const LlmScore = z.object({
  evidence_scan: z.array(
    z.object({
      criterion: z.enum(KEYS),
      quote: z.string(),
      level: z.number().int().min(1).max(4),
    }),
  ),
  years_pm_experience: z.number().min(0).max(40),
  why_ranked_here: z.string().min(10),
  probe_in_interview: z.array(z.string()).length(3),
});
export type LlmScore = z.infer<typeof LlmScore>;

export type Evidence = { level: number; quote: string | null; verified: boolean; dropped_quote?: string };
export type ScoredCv = {
  evidence: Record<Key, Evidence>;
  years: number;
  why: string;
  probes: string[];
  model: string;
};

const SYSTEM = `You are scoring an anonymised CV for Kargo, a Series A logistics SaaS company whose customers are freight forwarders and 3PLs.
Score ONLY against the six criteria and level anchors provided.
For every level above 0, copy the exact CV sentence that justifies it. No quote = level 0. Do not infer.
Ignore college, certifications, company brand, framework vocabulary and CV design.
Career switches from operations into tech are a positive signal, never a negative one.
Return JSON only, matching the schema. Do not compute totals.

The pattern Kargo hires for is "operator-turned-builder":
1. Lived the pain (A): hands-on time INSIDE a freight forwarder, CHA, NVOCC, port or 3PL — documentation, customs holds, carrier exceptions, berth windows. Selling to or integrating with logistics firms from outside is not hands-on ops.
2. Fixed it unasked (B): saw a broken manual process and built the fix without a mandate; others adopted it.
3. Owned it with no layer above (C, D, F): sole owner reporting to a founder; kills and post-mortems their own work and writes down why; calm in a named live incident.

Screening rules learned from Kargo's past hires:
- A polished, JD-shaped CV full of framework vocabulary and "supported senior PMs" bullets is the classic false positive. Do not reward vocabulary; reward what they did.
- Supply chain / carrier scheduling / exception management at a 3PL IS hands-on ops. Supply chain at an FMCG, manufacturing or e-commerce brand is adjacent only (A=1).
- Match each quote to the highest anchor it FULLY satisfies, not the one it gestures at.
- Search the WHOLE CV for each criterion before choosing. Consider every bullet in every role and pick the one that reaches the highest anchor — not the first plausible one. The same bullet may be used for more than one criterion.
- B (unasked): the fix must not be the job's own deliverable. Strong signals: "independently", "on my own", "over a weekend", "noticed/found that … so built", or someone in an ops / analyst / sales / support / CS role building a tool, tracker, dashboard, checklist or framework that other people then adopted. Work that IS the job is at most B=2, however well it went: a consultant's client deliverable, an assigned project, or a PM writing process docs for their own PM team. Adoption beyond themselves with scale stated (team size, number of teams/users) → 4; adopted by own team, no scale → 3.
- D needs an actual decision or learning artefact: a kill, reversal, post-mortem, root-cause analysis, or a data-driven decision. A quote that merely mentions workload, supervision or tasks is not D evidence → 0.
- F: a named disruption handled under time pressure with a clean outcome (vendor/system change without notice, customs inspection, outage, port hold, migration under deadline) is F=4 if they personally handled it. Generic "fast-paced" is F=1.
- Never use a quote that does not support the criterion just to fill the slot. Level 0 with null quote is correct when there is no evidence.
- Prefer experience bullets over summary claims. If only a summary line supports a criterion, cap that criterion at level 2.
- A testimonial or review quote is not evidence of an action; quote the action itself.
- Quotes must be a single contiguous span copied character-for-character from the CV (one sentence or bullet). No ellipses, no joining two sentences, no rewording.
- [NAME], [CONTACT REDACTED], [EDUCATION REDACTED] are redactions — ignore them.

Output fields:
- evidence_scan: go through the CV bullet by bullet. For EVERY bullet that is evidence for a criterion, add {criterion, quote, level} — one entry per criterion it supports, at the level that bullet alone fully earns. List all candidates, not just the best; typically 10–25 entries. Omit criteria with no evidence entirely. Criterion keys: A, B, C, D, E_PM (E with PM anchors), E_SPM (E with SPM anchors), F. All criteria except E are role-independent.
- years_pm_experience: years in product-manager-type ownership roles (PM/APM/product owner/founder owning product). 0 if none.
- why_ranked_here: 2 sentences in pattern language — what evidence exists for lived-the-pain / fixed-it-unasked / owned-it, and what is missing. Never say advance, pass, reject or hire.
- probe_in_interview: exactly 3 questions — one testing the weaker of A or B, one asking for specifics behind the strongest quote, one on a kill, post-mortem or live incident.`;

function userPrompt(cv: string): string {
  const anchors = anchorsText("PM");
  const eSpm = anchorsText("SPM").split("\n\n").find((b) => b.startsWith("E."))!;
  return `LEVEL ANCHORS (A–F; E shown for PM → use for E_PM)\n\n${anchors}\n\nE anchors for SPM → use for E_SPM\n${eSpm}\n\n--- CV (anonymised) ---\n${cv}\n--- END CV ---`;
}

const { $schema: _drop, ...RESPONSE_SCHEMA } = z.toJSONSchema(LlmScore) as Record<string, unknown>;

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in .env.local");
  return (client ??= new GoogleGenAI({ apiKey }));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Free tier has a per-minute request quota: keep calls at least MIN_GAP apart.
const MIN_GAP_MS = Number(process.env.GEMINI_MIN_GAP_MS ?? 4_000);
let lastCall = 0;

// Running token totals so each run can report what it cost.
export const usage = { calls: 0, input: 0, output: 0 };

async function callGemini(cv: string, model: string): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const wait = lastCall + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    try {
      const res = await ai().models.generateContent({
        model,
        contents: userPrompt(cv),
        config: {
          systemInstruction: SYSTEM,
          temperature: 0,
          responseMimeType: "application/json",
          responseJsonSchema: RESPONSE_SCHEMA,
        },
      });
      usage.calls++;
      usage.input += res.usageMetadata?.promptTokenCount ?? 0;
      usage.output += (res.usageMetadata?.candidatesTokenCount ?? 0) + (res.usageMetadata?.thoughtsTokenCount ?? 0);
      return res.text ?? "";
    } catch (e: any) {
      // Free tier: back off on rate limits / transient errors, never switch to a paid route.
      const status = e?.status ?? e?.code;
      // Daily free-tier cap: retrying only burns time. Stop and let a later run resume.
      if (status === 429 && /PerDay/.test(String(e?.message))) {
        throw new Error("Gemini free-tier DAILY quota reached for this model — resumes after the daily reset");
      }
      if ((status === 429 || status === 503 || status === 500) && attempt < 8) {
        await sleep(Math.min(90_000, 10_000 * 2 ** attempt) + Math.random() * 5_000);
        continue;
      }
      throw e;
    }
  }
}

// Returns null when the model output is invalid twice → caller marks parse_failed.
export async function scoreCv(redactedCv: string): Promise<ScoredCv | null> {
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  let parsed: LlmScore | null = null;
  for (let i = 0; i < 2 && !parsed; i++) {
    const raw = await callGemini(redactedCv, model);
    try {
      const r = LlmScore.safeParse(JSON.parse(raw));
      if (r.success) parsed = r.data;
    } catch {
      /* invalid JSON → retry once */
    }
  }
  if (!parsed) return null;
  if (process.env.DEBUG_SCAN) console.log(JSON.stringify(parsed.evidence_scan, null, 1));

  // Evidence rule, enforced in code: only verbatim quotes count; per criterion keep the
  // highest verified level. No verified quote → level 0.
  const evidence = {} as ScoredCv["evidence"];
  for (const k of KEYS) {
    const cands = parsed.evidence_scan.filter((e) => e.criterion === k).sort((a, b) => b.level - a.level);
    const best = cands.find((c) => quoteInText(c.quote, redactedCv));
    const unverified = cands.find((c) => c.level > (best?.level ?? 0) && !quoteInText(c.quote, redactedCv));
    evidence[k] = best
      ? { level: best.level, quote: best.quote, verified: true }
      : { level: 0, quote: null, verified: cands.length === 0 };
    if (unverified) evidence[k].dropped_quote = unverified.quote;
  }
  return {
    evidence,
    years: parsed.years_pm_experience,
    why: parsed.why_ranked_here,
    probes: parsed.probe_in_interview,
    model,
  };
}

export function levelsFor(s: ScoredCv, role: Role): Levels {
  const e = s.evidence;
  const pick = (c: Criterion) => (c === "E" ? e[role === "PM" ? "E_PM" : "E_SPM"] : e[c]).level;
  return { A: pick("A"), B: pick("B"), C: pick("C"), D: pick("D"), E: pick("E"), F: pick("F") };
}
