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
