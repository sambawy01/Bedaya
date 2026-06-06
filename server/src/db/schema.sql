-- Bedaya schema — adult literacy app
--
-- Privacy posture:
--   - voice never leaves the device (no audio columns)
--   - handwriting traces are NOT stored in v0 (canvas-only)
--   - learner identity: name + optional phone, no email required

CREATE TABLE IF NOT EXISTS bedaya_learners (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(30),
  voice_guide VARCHAR(20) NOT NULL DEFAULT 'umm_yasmin'
    CHECK (voice_guide IN ('umm_yasmin', 'amm_hassan')),
  letter_order VARCHAR(20) NOT NULL DEFAULT 'frequency'
    CHECK (letter_order IN ('frequency', 'moe', 'shape')),
  device_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  letters_known INT DEFAULT 0,
  sessions_completed INT DEFAULT 0,
  total_minutes INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_bedaya_learners_device ON bedaya_learners(device_id);

CREATE TABLE IF NOT EXISTS bedaya_letter_progress (
  id SERIAL PRIMARY KEY,
  learner_id INT REFERENCES bedaya_learners(id) ON DELETE CASCADE,
  letter VARCHAR(4) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'introduced'
    CHECK (status IN ('introduced', 'practising', 'mastered')),
  introduced_at TIMESTAMP DEFAULT NOW(),
  mastered_at TIMESTAMP,
  trace_count INT DEFAULT 0,
  story_count INT DEFAULT 0,
  UNIQUE(learner_id, letter)
);
CREATE INDEX IF NOT EXISTS idx_bedaya_progress_learner ON bedaya_letter_progress(learner_id);

CREATE TABLE IF NOT EXISTS bedaya_sessions (
  id SERIAL PRIMARY KEY,
  learner_id INT REFERENCES bedaya_learners(id) ON DELETE CASCADE,
  letter VARCHAR(4) NOT NULL,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_seconds INT,
  warmup_done BOOLEAN DEFAULT FALSE,
  phonics_done BOOLEAN DEFAULT FALSE,
  story_done BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_bedaya_sessions_learner ON bedaya_sessions(learner_id, started_at DESC);

CREATE TABLE IF NOT EXISTS bedaya_story_history (
  id SERIAL PRIMARY KEY,
  learner_id INT REFERENCES bedaya_learners(id) ON DELETE CASCADE,
  letters_used TEXT NOT NULL,
  story TEXT NOT NULL,
  topic VARCHAR(60),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bedaya_story_learner ON bedaya_story_history(learner_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Antura-style letter data model
--
-- Foundation for FSRS scheduling (Task 5), BKT mastery (Task 8), and the
-- DeepTutor memory layer (Task 7). Letters get stable INT IDs that downstream
-- learner-state tables reference by FK, replacing the legacy glyph string.
-- Contextual letter forms (initial/medial/final) and pre-validated words and
-- phrases get their own tables so offline lesson content can be authored once
-- and queried by allowed-letter-set.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bedaya_letters (
  id SERIAL PRIMARY KEY,
  glyph VARCHAR(4) UNIQUE NOT NULL,
  name_ar VARCHAR(20) NOT NULL,
  name_romanised VARCHAR(30) NOT NULL,
  sound VARCHAR(8) NOT NULL,
  letter_type VARCHAR(16) NOT NULL DEFAULT 'consonant'
    CHECK (letter_type IN ('consonant', 'vowel', 'symbol')),
  sort_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bedaya_letters_sort ON bedaya_letters(sort_id);

CREATE TABLE IF NOT EXISTS bedaya_letter_forms (
  id SERIAL PRIMARY KEY,
  letter_id INT NOT NULL REFERENCES bedaya_letters(id) ON DELETE CASCADE,
  position VARCHAR(10) NOT NULL
    CHECK (position IN ('isolated', 'initial', 'medial', 'final')),
  glyph_form VARCHAR(8) NOT NULL,
  diacritic VARCHAR(10) NOT NULL DEFAULT 'none'
    CHECK (diacritic IN ('none', 'fathah', 'dammah', 'kasrah', 'sukun', 'shaddah')),
  UNIQUE(letter_id, position, diacritic)
);

CREATE TABLE IF NOT EXISTS bedaya_words (
  id SERIAL PRIMARY KEY,
  word VARCHAR(40) UNIQUE NOT NULL,
  primary_letter_id INT REFERENCES bedaya_letters(id) ON DELETE SET NULL,
  theme VARCHAR(30),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bedaya_words_letter ON bedaya_words(primary_letter_id);

CREATE TABLE IF NOT EXISTS bedaya_phrases (
  id SERIAL PRIMARY KEY,
  phrase TEXT NOT NULL,
  letter_ids INT[] NOT NULL,
  theme VARCHAR(30),
  validated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bedaya_phrases_validated ON bedaya_phrases(validated);

-- Additive FK on existing progress table. The legacy `letter` glyph column
-- stays during migration so reads keep working until backfill completes.
ALTER TABLE bedaya_letter_progress
  ADD COLUMN IF NOT EXISTS letter_id INT REFERENCES bedaya_letters(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_bedaya_progress_letter_id ON bedaya_letter_progress(letter_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- DeepTutor-style dual-layer learner memory
--
-- summary  — dated event log appended on session completion: introduced ا,
--            mastered ب, story read about home. Derived from server-side
--            observable signals only: no audio, no trace data.
-- profile  — learner style notes: motivation, preferred topics, pace.
--            Stays empty in v0; facilitator dashboard (future) writes here.
--
-- Both fields are injected into the story generator's system prompt so
-- generated reading payoffs reference the learner's own progress and style.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bedaya_learner_memory (
  learner_id INT PRIMARY KEY REFERENCES bedaya_learners(id) ON DELETE CASCADE,
  summary TEXT NOT NULL DEFAULT '',
  profile TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- FSRS-6 spaced-repetition card state per (learner, letter).
-- Drives the warm-up scheduler: letters with the earliest `due` timestamp get
-- surfaced first, so reviews track each learner's actual forgetting curve
-- instead of replaying the full known-letters list every session.
-- ─────────────────────────────────────────────────────────────────────────────

-- due / last_review are TIMESTAMPTZ so cross-timezone comparisons against
-- NOW() are unambiguous. The other tables use TIMESTAMP for historical
-- reasons; only the scheduler depends on accurate time math.
CREATE TABLE IF NOT EXISTS bedaya_letter_fsrs (
  learner_id INT NOT NULL REFERENCES bedaya_learners(id) ON DELETE CASCADE,
  letter_id INT NOT NULL REFERENCES bedaya_letters(id) ON DELETE CASCADE,
  due TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stability DOUBLE PRECISION NOT NULL DEFAULT 0,
  difficulty DOUBLE PRECISION NOT NULL DEFAULT 0,
  elapsed_days INT NOT NULL DEFAULT 0,
  scheduled_days INT NOT NULL DEFAULT 0,
  reps INT NOT NULL DEFAULT 0,
  lapses INT NOT NULL DEFAULT 0,
  state INT NOT NULL DEFAULT 0, -- 0 New, 1 Learning, 2 Review, 3 Relearning
  last_review TIMESTAMPTZ,
  PRIMARY KEY (learner_id, letter_id)
);
CREATE INDEX IF NOT EXISTS idx_bedaya_fsrs_due ON bedaya_letter_fsrs(learner_id, due);

-- Idempotent type coercion if the table existed pre-fix.
ALTER TABLE bedaya_letter_fsrs
  ALTER COLUMN due TYPE TIMESTAMPTZ USING due AT TIME ZONE 'UTC';
ALTER TABLE bedaya_letter_fsrs
  ALTER COLUMN last_review TYPE TIMESTAMPTZ USING last_review AT TIME ZONE 'UTC';

-- ─────────────────────────────────────────────────────────────────────────────
-- Bayesian Knowledge Tracing — replaces the heuristic "facilitator decides
-- mastery" path with a probabilistic latent-skill estimate per letter.
-- p_mastered starts at the L0 prior (0.1) and updates on every observable
-- signal (trace, phonics, story). The session loop promotes a letter to
-- mastered when p_mastered crosses MASTERY_THRESHOLD and enough reps have
-- accumulated so we don't promote off a single lucky observation.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE bedaya_letter_progress
  ADD COLUMN IF NOT EXISTS p_mastered DOUBLE PRECISION NOT NULL DEFAULT 0.1;
ALTER TABLE bedaya_letter_progress
  ADD COLUMN IF NOT EXISTS bkt_reps INT NOT NULL DEFAULT 0;

-- Extend the letter_order CHECK to include 'shape' for facilitator deployments
-- that prefer Antura's shape-family grouping. Drop+recreate is the only way
-- to widen a CHECK constraint idempotently.
ALTER TABLE bedaya_learners
  DROP CONSTRAINT IF EXISTS bedaya_learners_letter_order_check;
ALTER TABLE bedaya_learners
  ADD CONSTRAINT bedaya_learners_letter_order_check
    CHECK (letter_order IN ('frequency', 'moe', 'shape'));

-- One-shot flag: once a learner's known letters have all been backfilled into
-- bedaya_letter_fsrs, planLesson skips the backfill entirely on every
-- subsequent call. New learners post-fix are also flagged on first plan so
-- the backfill INSERT runs at most once per learner ever. After this,
-- /lessons/start is the only path that creates FSRS cards.
ALTER TABLE bedaya_learners
  ADD COLUMN IF NOT EXISTS fsrs_backfilled_at TIMESTAMPTZ;
