# CLAUDE.md — Kargo Hiring Dashboard (MESA Case 2)

This file is the project context. Read it fully before planning or writing code.
Kargo, Arjun Mehta and all candidate data are fictional (MESA course case).

---

## 1. Why this exists

| | |
|---|---|
| **User** | Arjun Mehta, founder of Kargo (Series A logistics SaaS, Mumbai, 40 → 70 people by Dec). No HR team. He is the hiring manager for every role and reviews CVs late at night in 45-minute gaps. |
| **Pain** | PM and Senior PM roles open since July. 11 weeks: 60 applications, 19 opened, 0 offers. No record of why anyone was shortlisted or passed. Two strong candidates got "let's chat" in August and were never followed up. 19 opened applicants never heard back. |
| **Outcome** | An offer to the right person before December. Not a nicer process — an offer. |
| **Root cause** | He screens against the JD, but his successful hires share a pattern the JD never asks for. |

**Operating principle (non-negotiable):** *The system recommends. Arjun decides. His decision is the last thing he touches.*

**The Cut:** Arjun wants "everything downstream to happen without him". We do NOT build auto-rejection or any email that fires on a score alone. Every email (invite or rejection) is drafted by AI and sent only after Arjun clicks. That click is the only trigger.

---

## 2. Data folders

```
data/
  applications/   # 60 CVs, mixed formats (.docx, .pdf, maybe .txt) — PM and SPM
  hires/          # 8 past hire profiles (CV + what stood out + interview notes + one-line outcome)
  jds/            # MESA_Kargo_JD_Product_Manager.docx, MESA_Kargo_JD_Senior_Product_Manager.docx
```
If a folder is missing or empty, stop and ask — do not invent data.

**Actual contents (verified 2026-09-28, Phase 0):**
- `applications/` — 60 PDFs, all parse with pypdf (`data/_text/` holds extracted text). Source: Drive folder "resumes".
  - `pm_01`–`pm_15` → PM (15) · `spm_16`–`spm_30` → SPM (15) — role from filename prefix.
  - `01`–`30` → **no role tag**. Mixed, real-world-style CVs (strategy, marketing, students, PMs 2–17 yrs).
  - `14_sneha_kulkarni` and `21_aryan_kulkarni` are the **same CV with the name swapped** — must score identically (blind-scoring check).
- `hires/` — 8 .docx, **CVs only**. Drive folder "hires" holds the same files. No "what stood out", interview notes or outcome line — the §3 pattern cannot yet be confirmed against outcomes.
- `jds/` — 2 .docx (PM, SPM).

Screening agent: `.claude/agents/kargo-ats.md` (scores one CV → JSON; never decides or emails).

---

## 3. The success pattern: "operator-turned-builder"

Derived from the 8 past hires. Five share it; three (the most JD-shaped profiles) don't.

1. **Lived the pain** — hands-on time inside a freight forwarder, CHA, port, NVOCC or 3PL (documentation, customs holds, carrier exceptions, berth windows). Selling to or integrating with logistics firms from outside does not count.
2. **Fixed it unasked** — saw a broken manual process and built the fix without a mandate (Excel tracker, weekend prototype, checklist), and others adopted it.
3. **Owned it with no layer above** — no manager / product layer / account-manager buffer; calm in a live crisis; writes down what went wrong and why.

| Hire | Role | Group | Rubric score (PM weights) |
|---|---|---|---|
| Lavanya Iyer | PM | Operator | 97.5 |
| Rohan Desai | Engineer | Operator | 86.25 |
| Sunita Krishnamurthy | Ops | Operator | 85 |
| Aditya Shetty | Sales | Operator | 81.25 |
| Meghna Tiwari | Customer Success | Operator | 80 |
| Preetham Rao | Engineer | Spec | 47.5 |
| Rahul Bose | Marketing | Spec | 40 |
| Vikram Nair | PM | Spec | 36.25 |

**Status: hypothesis.** The pattern was derived from CVs only. Before relying on it, read each profile's outcome note in `data/hires/` and confirm the Operators are the ones still at Kargo and thriving. If not, tell the user and stop before re-weighting.
**Decision (2026-09-28):** outcome notes don't exist in the case data. User approved proceeding with the pattern as an *unconfirmed hypothesis*. Calibration (§8.1) checks the scorer reproduces the table above — not that the pattern predicts success. Say so in the README and demo.

The JDs support the pattern in their own words: PM JD — "shipped things, killed things, and learned from both", "comfort operating without structure", "curiosity about how operations work at ground level", "spent time inside freight forwarding operations". SPM JD — "owning a product area without a layer of senior PMs above you", "make calls in ambiguous situations", "familiarity with operations-heavy industries … is a genuine advantage, not a nice-to-have".

---

## 4. Rubric (source of truth: `rubric.json`)

Six criteria, each scored level 0–4. **Score = Σ(weight × level ÷ 4)**, out of 100. Code computes this — never the LLM.

| # | Criterion | PM weight | SPM weight |
|---|---|---|---|
| A | Operational proximity to freight | 25 | 20 |
| B | Built the fix unasked | 20 | 15 |
| C | Ownership without a layer | 15 | 15 |
| D | Judgment & learning loops (kill, post-mortem, documents why) | 15 | 15 |
| E | Product craft for the role | 15 | 25 |
| F | Composure in live operations | 10 | 10 |

Full level anchors live in `rubric.json`. Key role differences for E:
- **PM (E=4):** owned a product area; shipped 3+ features with measured outcomes; runs discovery directly with users; has shipped *and killed* things.
- **SPM (E=4):** owned an integration / platform / data layer (carrier systems, port portals, ERP, FMS, APIs); made build-vs-configure-vs-don't-touch calls; set up product practices others adopted. JD asks 5–8 yrs PM.

**Evidence rule:** every level > 0 must carry an exact quote from the CV. No quote → level 0.

**Bands:** 75–100 Strong match · 55–74 Partial (probe A & B) · 35–54 Spec match only · 0–34 No match. Bands order the dashboard; they never trigger an email.

**Flags (surface to Arjun, never auto-reject):**
- `pattern_floor`: A = 0 and B = 0
- `spm_shipping_floor`: SPM applicant with E ≤ 1
- `consider_for_pm`: SPM applicant scoring < 55 on SPM weights but ≥ 75 on PM weights
- `experience_below_jd`: years below the JD range — shown as info only. Lavanya had ~2 yrs PM; years are a soft signal.
- `parse_failed`: CV unreadable → route to Arjun unscored

**Never score (anti-signals):** college tier/brand, PM certifications, framework vocabulary (JTBD, OKRs, Reforge), company brand or size, conference talks, CV design. Never penalise career switches. Strip name, gender, photo, age, address, college before the LLM call; restore only in the UI.

---

## 5. Architecture (follows the user's Components Map, with 4 fixes)

| Stage | What happens |
|---|---|
| **Trigger** | Arjun uploads CVs (single or bulk / whole folder) and tags role PM or SPM. |
| **Input** | CV file + role. |
| **Processing (code)** | Parse .docx (mammoth) / .pdf / .txt → plain text. Extract contact details into a separate record. Redact PII + college from the text sent to AI. |
| **Context** | `rubric.json` + pattern summary (§3) + the role's JD. *(Fix 1: context was empty in the original map.)* |
| **AI (LLM)** | Returns JSON: levels + quotes per criterion, `why_ranked_here`, 3 interview probes. Separate call drafts the email only after a decision. *(Fix 2: scoring is an AI judgment; code does the maths.)* |
| **Output** | Dashboard: ranked list per role, score, band, flags, quotes, probes. |
| **Decision** | Arjun clicks **Advance / Pass / Consider for PM**. *(Fix 3: explicit human step.)* |
| **Action** | AI drafts the personalised invite or kind rejection → Arjun reviews → one click sends via Resend. |
| **Log** | Every candidate, score, quotes, decision, email sent + timestamp is persisted. *(Fix 4: "no record of why" is the original pain.)* |

### LLM output schema (per CV)
```json
{
  "role_applied": "PM",
  "criteria": {
    "A": {"level": 0, "quote": null},
    "B": {"level": 0, "quote": null},
    "C": {"level": 0, "quote": null},
    "D": {"level": 0, "quote": null},
    "E": {"level": 0, "quote": null},
    "F": {"level": 0, "quote": null}
  },
  "years_pm_experience": 0,
  "why_ranked_here": "2 sentences in pattern language",
  "probe_in_interview": ["q1", "q2", "q3"]
}
```
Validate with a schema (zod). On invalid JSON, retry once, then mark `parse_failed`. Quotes must appear verbatim in the CV text — verify in code; drop the level to 0 if the quote isn't found.

### Scoring system prompt (core)
```
You are scoring an anonymised CV for Kargo, a Series A logistics SaaS company whose customers are freight forwarders and 3PLs.
Score ONLY against the six criteria and level anchors provided for the stated role.
For every level above 0, copy the exact CV sentence that justifies it. No quote = level 0. Do not infer.
Ignore college, certifications, company brand, framework vocabulary and CV design.
Career switches from operations into tech are a positive signal, never a negative one.
Return JSON only, matching the schema. Do not compute totals.
```

### Email drafting rules
- Invite: warm, specific (reference 1 real thing from their CV), proposes next step, signed by Arjun.
- Rejection: kind, brief, prompt, no score or rubric language, no false promises.
- Never mention AI scoring in candidate emails.

---

## 6. Tech defaults (confirm with the user before scaffolding)

- Next.js (App Router) + TypeScript + Tailwind; local run first.
- LLM: **Google Gemini free tier** (`@google/genai`); model from env `GEMINI_MODEL` (don't hardcode a model name). Free tier is rate-limited → score sequentially with backoff. Redaction (§4) happens before every call.
- Resend for email (free tier). Persistence: **Neon Postgres** (project `rapid-resonance-82624800`, branch `production`, free plan) via `DATABASE_URL` in `.env.local` — replaces SQLite/Supabase.
- **Free tier only, everywhere.** Never upgrade a plan or enable a paid feature. Neon AI Gateway needs a paid plan → not used. The Anthropic API is pay-per-call → confirm the LLM route with the user before any bulk scoring.
- `.env.local` (gitignored): `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `RESEND_API_KEY`, `RESEND_FROM`, `EMAIL_OVERRIDE_TO`.

### Email safety (important)
CV email addresses are fictional but could belong to real people. **All sends go to `EMAIL_OVERRIDE_TO`** (the user's own inbox) unless the user explicitly turns the override off. Resend's free tier without a verified domain can only send from `onboarding@resend.dev` to the account's own email anyway.

---

## 7. Tools in this session

**GitHub (via GitHub Desktop + git/gh):**
- The user manages the repo in GitHub Desktop. Work in the repo folder GitHub Desktop cloned; use plain `git` and `gh` from the terminal.
- Work on a feature branch, small commits with clear messages. Ask before pushing, and before creating a PR. The user reviews diffs in GitHub Desktop.
- Never commit `.env*`, API keys, or the `data/` CVs (add `data/` to `.gitignore` unless the user says otherwise).

**Claude in Chrome (`claude --chrome`):**
- Use it to test the running app at `http://localhost:3000`: upload CVs, check the ranking renders, click Advance/Pass, confirm the draft appears.
- Use it to verify delivery in the Resend dashboard (Emails → Logs) — read only.
- Never type passwords or API keys into pages; if a login is needed, pause and ask the user to do it. Don't trigger browser alert/confirm dialogs.

---

## 8. Definition of done

1. Calibration: the 8 hire CVs, run through the scorer, land within ±1 level per criterion of the table in §3 (Operators ≥ 75, Spec < 55).
2. All 60 applications scored; ranked lists per role; every level has a verifiable quote.
3. Advance / Pass / Consider-for-PM works; drafts generate; one click sends to `EMAIL_OVERRIDE_TO`; Resend log confirms.
4. Decision log exportable as CSV.
5. Blind-scoring check: shortlist rates by college tier don't skew (report the numbers).
6. README with setup and a 2-minute demo script.
