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
    CHECK (letter_order IN ('frequency', 'moe')),
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
