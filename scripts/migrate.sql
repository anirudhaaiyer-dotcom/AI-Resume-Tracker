-- Kargo hiring dashboard schema (Neon Postgres). Idempotent.

CREATE TABLE IF NOT EXISTS candidates (
  id              SERIAL PRIMARY KEY,
  source_file     TEXT UNIQUE NOT NULL,
  pool            TEXT NOT NULL DEFAULT 'application' CHECK (pool IN ('application', 'hire')),
  role_tag        TEXT CHECK (role_tag IN ('PM', 'SPM')),          -- from filename/upload; NULL = untagged
  role_suggested  TEXT CHECK (role_suggested IN ('PM', 'SPM')),    -- untagged only; Arjun confirms
  role_confirmed  TEXT CHECK (role_confirmed IN ('PM', 'SPM')),
  name            TEXT,          -- contact details: UI only, never sent to the LLM
  email           TEXT,
  phone           TEXT,
  links           JSONB NOT NULL DEFAULT '[]',
  redacted_text   TEXT,
  parse_failed    BOOLEAN NOT NULL DEFAULT FALSE,
  parse_error     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per candidate × weighting, so untagged CVs carry both views.
CREATE TABLE IF NOT EXISTS scores (
  id              SERIAL PRIMARY KEY,
  candidate_id    INT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  weighting       TEXT NOT NULL CHECK (weighting IN ('PM', 'SPM')),
  levels          JSONB NOT NULL,   -- {"A":4,...}
  evidence        JSONB NOT NULL,   -- {"A":{"level","quote","verified","dropped_quote"},...}
  total           NUMERIC(6,2) NOT NULL,
  band            TEXT NOT NULL,
  flags           TEXT[] NOT NULL DEFAULT '{}',
  years_pm        NUMERIC(4,1),
  why_ranked_here TEXT,
  probes          JSONB,
  model           TEXT,
  scored_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, weighting)
);

-- Only a click in the UI inserts here. No score, band or flag ever does.
CREATE TABLE IF NOT EXISTS decisions (
  id              SERIAL PRIMARY KEY,
  candidate_id    INT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  action          TEXT NOT NULL CHECK (action IN ('advance', 'pass', 'consider_for_pm')),
  role            TEXT CHECK (role IN ('PM', 'SPM')),
  note            TEXT,
  decided_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emails (
  id              SERIAL PRIMARY KEY,
  decision_id     INT NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('invite', 'rejection')),
  draft_subject   TEXT,
  draft_body      TEXT,
  final_subject   TEXT,
  final_body      TEXT,
  sent_to         TEXT,          -- always EMAIL_OVERRIDE_TO unless the user turns the override off
  resend_id       TEXT,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'failed')),
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS scores_rank_idx ON scores (weighting, total DESC);

-- 'sending' lets one click claim a draft atomically, so a double-click can't send twice.
ALTER TABLE emails DROP CONSTRAINT IF EXISTS emails_status_check;
ALTER TABLE emails ADD CONSTRAINT emails_status_check CHECK (status IN ('draft', 'sending', 'sent', 'failed'));
