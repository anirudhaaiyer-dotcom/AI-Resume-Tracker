# Kickoff — Kargo Hiring Dashboard in Claude Code

## One-time setup (≈10 min, on your Mac)

1. **Repo via GitHub Desktop**
   File → New Repository → name `kargo-hiring` → create → Publish repository (private).
   Copy `CLAUDE.md` and `rubric.json` into the repo root.
   Create `data/applications/`, `data/hires/`, `data/jds/` and drop the case files in.

2. **GitHub CLI (so Claude Code can push / open PRs)**
   ```bash
   brew install gh
   gh auth login        # GitHub.com → HTTPS → login with browser
   ```

3. **Claude in Chrome**
   Install / update the Claude in Chrome extension (v1.0.36+) and sign in with the same Claude account.
   Claude Code must be logged in with `/login` (a plain API key disables the Chrome link).

4. **Keys ready** (don't paste into chat — Claude Code will create `.env.local` and you fill it):
   Anthropic API key · Resend API key · your own email for `EMAIL_OVERRIDE_TO`.

5. **Launch**
   ```bash
   cd ~/Documents/GitHub/kargo-hiring   # wherever GitHub Desktop put it
   claude --chrome
   ```
   Inside Claude Code, check: `/chrome` shows *Enabled*, and `/context` lists `CLAUDE.md` under memory files.

---

## Paste this into Claude Code

```text
Read CLAUDE.md and rubric.json in full before doing anything. They are the source of truth for this project.

Context: I'm building the MESA Case 2 hiring dashboard for Arjun (founder, Kargo). The system recommends; Arjun decides; his click is the only thing that sends an email. No auto-rejection — that's the Cut.

Work in this order and stop at each checkpoint for my OK:

PHASE 0 — Verify inputs
- List what's in data/applications, data/hires, data/jds (count by format and role).
- Read every hire profile's outcome note. Tell me whether the "Operator" hires in CLAUDE.md §3 are the ones still at Kargo and thriving. If the pattern doesn't hold, stop and propose re-weighting — don't proceed.
CHECKPOINT 1.

PHASE 1 — Plan
- Propose the stack (default in CLAUDE.md §6), folder structure, data model (candidate, score, quotes, flags, decision, email log) and the screens.
- Create a feature branch. Add .gitignore covering .env*, node_modules, data/.
- Create .env.local.example with the variables from §6; I'll fill .env.local myself.
CHECKPOINT 2.

PHASE 2 — Scoring engine (no UI yet)
- CV parsing (.docx/.pdf/.txt), PII + college redaction, LLM scoring call returning the JSON schema, zod validation, quote-verification (quote must exist verbatim in the CV or level → 0), weighted maths and flags in code from rubric.json.
- Calibration: score the 8 hire CVs and show me a table vs CLAUDE.md §3. Must be within ±1 level per criterion; tighten prompt/anchors if not.
CHECKPOINT 3.

PHASE 3 — Run the 60
- Score all applications. Show top 10 per role with score, band, flags, and one-line why. Report shortlist rates by college tier (blind-scoring check).
CHECKPOINT 4.

PHASE 4 — Dashboard + decisions
- Ranked list per role → candidate detail (score breakdown with quotes, why ranked here, 3 interview probes) → Advance / Pass / Consider for PM.
- On decision: AI drafts the invite or kind rejection → I can edit → one "Send" click → Resend, always to EMAIL_OVERRIDE_TO.
- Decision log persisted and exportable as CSV.
- Then use Chrome to test it end to end on localhost:3000: upload a CV, advance one, pass one, send both, and confirm both in the Resend dashboard logs. Screenshot the key screens. If any login is needed, pause and ask me.
CHECKPOINT 5.

PHASE 5 — Ship
- README with setup + a 2-minute demo script for class.
- Commit in small, clearly named commits. Ask before pushing; then push the branch and open a PR with gh so I can review in GitHub Desktop.

Rules: never commit secrets or CVs; never email an address from a CV; never let a score or band send an email; ask me when something in the data is missing rather than inventing it.
```
