# Kargo Hiring Dashboard (MESA Case 2)

Screening for Kargo's **Product Manager** and **Senior Product Manager** roles.
**The system recommends. Arjun decides. His click is the only thing that sends an email.**

Kargo, Arjun Mehta and all candidates are fictional (MESA course case).

## What it does

1. **Upload CVs** (.pdf / .docx / .txt, one or many) and tag the role.
2. Code parses each CV and **removes name, contact details and college** before scoring.
3. Gemini scores the CV against the six criteria in [`rubric.json`](rubric.json) and must quote the CV **verbatim** for every level above 0.
   Code checks every quote against the CV text; a quote that isn't there scores 0. **Code, not the model, computes the score, band and flags.**
4. The **dashboard** ranks candidates per role. Each candidate page shows the evidence quote per criterion, "why ranked here", and **3 interview questions** aimed at their gaps.
5. Arjun clicks **Advance** (drafts an interview invite) or **Pass** (drafts a kind rejection). For Senior PM applicants, **Consider for PM** moves them to the PM list.
6. He edits the draft if he wants and clicks **Send** once. Resend delivers it.
7. Every decision, score and email is kept in the **decision log** (CSV export).

### The rubric: "operator-turned-builder"

| # | Criterion | PM | SPM |
|---|---|---|---|
| A | Operational proximity to freight (hands-on at a forwarder / CHA / port / 3PL) | 25 | 20 |
| B | Built the fix unasked (and others adopted it) | 20 | 15 |
| C | Ownership without a layer above | 15 | 15 |
| D | Judgment and learning loops (killed / post-mortemed their own work) | 15 | 15 |
| E | Product craft for the role | 15 | 25 |
| F | Composure in live operations | 10 | 10 |

Score = Σ(weight × level ÷ 4). Bands: **75+ Strong · 55–74 Partial · 35–54 Spec match only · <35 No match**. Bands order the list; they never send anything.

## Safety rules built in

- **No email ever fires on a score, band or flag.** Only the Send button sends, and it can't send twice.
- **All email goes to `EMAIL_OVERRIDE_TO`** (your own inbox), with the intended candidate named in the subject. Addresses on the CVs are never emailed.
- Emails never mention scoring, rubrics or AI. The model drafting them never sees the candidate's name or contact details.
- College, certifications, company brand and framework vocabulary are never scored.

## Setup

Requires Node 20+, a Neon project (free plan), a Gemini API key and a Resend account (free).

```bash
npm install
cp .env.local.example .env.local   # then fill it in (see below)
npm run migrate                     # creates the tables in Neon
npm run calibrate                   # scores the 8 past hires, checks the rubric reproduces them
npm run score                       # scores everything in data/applications (skips already-scored CVs)
npm run dev                         # http://localhost:3000
```

`.env.local`:

| Variable | What |
|---|---|
| `DATABASE_URL` | Neon connection string (`neon link` writes it) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini key; model defaults to `gemini-3.8-flash` |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM` | `onboarding@resend.dev` unless you've verified a domain |
| `EMAIL_OVERRIDE_TO` | Your inbox. On Resend's free tier this must be the email you signed up with. |

CV files live in `data/` (git-ignored, never committed).

Useful scripts: `npx tsx scripts/report.ts` (top 10 per role, blind check, college-tier check) ·
`npx tsx scripts/show-evidence.ts <file>` (quotes behind a score) · `npx tsx scripts/check-redaction.ts` (PII leak check, no AI calls).

## Results on the case data

**Calibration on the 8 past hires:** 6 of 8 land where `CLAUDE.md` §3 says. All 3 "Spec" hires score below 55; Lavanya, Rohan and Meghna score above 75.
Sunita (68.75) and Aditya (62.5) fall short because the hand-made table is more generous than the rubric's own anchors. Aditya was in *sales* at a port-services firm, and the rubric says selling from outside is not hands-on ops. We kept `rubric.json` as the source of truth.

**Why the "Spec" hires score low even though they were hired:** they were hired on the JD's surface (title, years, credentials, polish). On a keyword-and-credential screen (`scripts/old-ats-baseline.ts`), Vikram ranks **1st** of the 8 and Rohan, a strong Operator, ranks **last**. The rubric scores something else: the pattern the successful hires share.

> The pattern is a **hypothesis**. The case data has no outcome notes (who stayed, who thrived), so calibration shows the scorer reproduces the pattern, not that the pattern predicts success.

**60 applications:** 9 Strong matches (5 PM, 4 SPM). Shortlist rate by college tier (tier read from the raw CV, never shown to the scorer): Tier 1 19% (5/27), other colleges 30% (10/33). No tilt towards big-name colleges.

**Known limitation:** Gemini isn't perfectly repeatable. Two identical CVs in the set (Sneha / Aryan) scored 55 vs 50, one level apart on criterion F. Scoring each CV twice and keeping the lower level where they disagree fixes this, at double the calls.

## 2-minute demo script

1. **(15 s) The problem.** "Arjun has 60 applications, 0 offers, and no record of why anyone was passed. He screens against the JD, but the people who work out at Kargo share a pattern the JD never asks for."
2. **(20 s) The pattern.** Show the rubric table above: operator-turned-builder. "Hands-on freight ops, fixed something nobody asked them to fix, owned it with no layer above."
3. **(25 s) Proof on past hires.** Show the calibration table. "The polished MBA PM ranks 1st on a keyword screen and 7th of 8 here. The ex-CHA engineer ranks last on keywords and 2nd here."
4. **(30 s) The dashboard.** Open *Product Manager*, then the top candidate. Point at a quote: "every point has a quote from the CV, checked by code". Then *Ask in the interview*: three questions aimed at this person's gaps.
5. **(20 s) The decision.** Click **Advance**: an invite is drafted that mentions one real thing from their CV. Edit a word. Click **Send**.
6. **(10 s) Pass.** On a low scorer, click **Pass**: a kind, three-line rejection, no scores, no false promises. Send.
7. **(10 s) The record.** Open the *Decision log*, then **Export CSV**. "That's the record of why that didn't exist before. And nothing was sent until Arjun clicked."
