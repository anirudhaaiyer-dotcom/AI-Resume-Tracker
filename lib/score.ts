import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { anchorsText, type Criterion, type Levels, type Role } from "./rubric";
import { quoteInText } from "./parse";

const Level = z.object({
  level: z.number().int().min(0).max(4),
  quote: z.string().nullable(),
});

// One call returns E for both roles, so PM and SPM weightings (and consider_for_pm)
// come from the same judgment — half the free-tier calls.
export const LlmScore = z.object({
  criteria: z.object({ A: Level, B: Level, C: Level, D: Level, E_PM: Level, E_SPM: Level, F: Level }),
  years_pm_experience: z.number().min(0).max(40),
  why_ranked_here: z.string().min(10),
  probe_in_interview: z.array(z.string()).length(3),
});
export type LlmScore = z.infer<typeof LlmScore>;

export type Evidence = { level: number; quote: string | null; verified: boolean; dropped_quote?: string };
export type ScoredCv = {
  evidence: Record<"A" | "B" | "C" | "D" | "E_PM" | "E_SPM" | "F", Evidence>;
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
- Prefer experience bullets over summary claims. If only a summary line supports a criterion, cap that criterion at level 2.
- A testimonial or review quote is not evidence of an action; quote the action itself.
- Quotes must be a single contiguous span copied character-for-character from the CV (one sentence or bullet). No ellipses, no joining two sentences, no rewording.
- [NAME], [CONTACT REDACTED], [EDUCATION REDACTED] are redactions — ignore them.

Output fields:
- criteria.E_PM uses the PM anchors for E; criteria.E_SPM uses the SPM anchors for E. All other criteria are role-independent.
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

async function callGemini(cv: string, model: string): Promise<string> {
  for (let attempt = 0; ; attempt++) {
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
      return res.text ?? "";
    } catch (e: any) {
      // Free tier: back off on rate limits / transient errors, never switch to a paid route.
      const status = e?.status ?? e?.code;
      if ((status === 429 || status === 503 || status === 500) && attempt < 5) {
        await sleep(Math.min(60_000, 8_000 * 2 ** attempt));
        continue;
      }
      throw e;
    }
  }
}

// Returns null when the model output is invalid twice → caller marks parse_failed.
export async function scoreCv(redactedCv: string): Promise<ScoredCv | null> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
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

  // Evidence rule, enforced in code: a quote must exist verbatim in the CV or the level drops to 0.
  const evidence = {} as ScoredCv["evidence"];
  for (const [k, v] of Object.entries(parsed.criteria) as [keyof ScoredCv["evidence"], z.infer<typeof Level>][]) {
    if (v.level === 0) evidence[k] = { level: 0, quote: null, verified: true };
    else if (v.quote && quoteInText(v.quote, redactedCv)) evidence[k] = { level: v.level, quote: v.quote, verified: true };
    else evidence[k] = { level: 0, quote: null, verified: false, dropped_quote: v.quote ?? "(no quote)" };
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
