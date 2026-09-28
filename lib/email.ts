import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

export type EmailKind = "invite" | "rejection";

const Draft = z.object({ subject: z.string().min(3), paragraphs: z.array(z.string().min(10)).min(1).max(4) });
const { $schema: _drop, ...DRAFT_SCHEMA } = z.toJSONSchema(Draft) as Record<string, unknown>;

const RULES = `You write short candidate emails for Arjun Mehta, founder of Kargo (logistics SaaS for freight forwarders and 3PLs, Mumbai).
Write as Arjun, first person, plain and warm.
Return JSON {subject, paragraphs}: 2–3 short body paragraphs as separate strings. Do NOT include a greeting or a sign-off — code adds "Hi <name>," and Arjun's signature.
Never mention scores, rubrics, criteria, ranking, screening tools or AI. Never promise anything you cannot guarantee. No markdown.`;

const INVITE = `Write an interview INVITE for the {{role}} role.
- Reference exactly ONE specific real thing from their experience (use one of the facts below, in your own words — do not quote the CV back verbatim).
- Propose the next step: a 45-minute conversation with Arjun this week or next, in person at the Mumbai office or on a call; ask them to reply with two or three times that work.
- 90–140 words.`;

const REJECTION = `Write a kind, brief REJECTION for the {{role}} role.
- Thank them for applying and for their time. Say we won't be moving forward for this role.
- Brief: 50–90 words. No reasons tied to assessment, no "we'll keep your CV on file" unless true (it is not — do not say it), no false encouragement.
- You may acknowledge one genuine strength from the facts below in a single clause, but it is optional.`;

let client: GoogleGenAI | null = null;
const ai = () => (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }));

// The model never sees the candidate's name or contact details; code fills {{first_name}}.
export async function draftEmail(opts: {
  kind: EmailKind;
  role: "PM" | "SPM";
  facts: string[]; // verified quotes from the redacted CV
  firstName: string;
}): Promise<{ subject: string; body: string }> {
  const roleName = opts.role === "PM" ? "Product Manager" : "Senior Product Manager";
  const task = (opts.kind === "invite" ? INVITE : REJECTION).replaceAll("{{role}}", roleName);
  const facts = opts.facts.length ? opts.facts.map((f) => `- ${f}`).join("\n") : "- (none available)";
  const res = await ai().models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    contents: `${task}\n\nFacts from their CV:\n${facts}`,
    config: {
      systemInstruction: RULES,
      temperature: 0.4,
      responseMimeType: "application/json",
      responseJsonSchema: DRAFT_SCHEMA,
    },
  });
  const draft = Draft.parse(JSON.parse(res.text ?? "{}"));
  // Layout is assembled in code so every email reads the same: greeting, paragraphs, signature.
  const body = [`Hi ${opts.firstName || "there"},`, ...draft.paragraphs.map((p) => p.trim()), "Best,\nArjun Mehta\nFounder, Kargo"].join("\n\n");
  return { subject: draft.subject.trim(), body };
}

// Every send goes to EMAIL_OVERRIDE_TO (the user's own inbox) — CV addresses are never emailed.
// The intended recipient is shown in the subject so the demo still reads correctly.
export async function sendViaResend(opts: {
  subject: string;
  body: string;
  intendedName: string;
  intendedEmail: string | null;
}): Promise<{ id: string; to: string }> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.EMAIL_OVERRIDE_TO;
  const from = process.env.RESEND_FROM || "onboarding@resend.dev";
  if (!key) throw new Error("RESEND_API_KEY is not set in .env.local");
  if (!to) throw new Error("EMAIL_OVERRIDE_TO is not set in .env.local — refusing to send");

  const intended = `${opts.intendedName}${opts.intendedEmail ? ` <${opts.intendedEmail}>` : ""}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `Arjun Mehta (Kargo) <${from}>`,
      to: [to],
      subject: `[for ${intended}] ${opts.subject}`,
      text: opts.body,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !json.id) throw new Error(`Resend ${res.status}: ${json.message ?? "send failed"}`);
  return { id: json.id, to };
}
