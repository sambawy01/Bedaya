/**
 * DeepTutor-style dual-layer learner memory.
 *
 * SUMMARY: append-only dated log of observable learning events (introduced,
 *          mastered, story read). Derived purely from server-side signals —
 *          no audio, no trace data — so this layer preserves Bedaya's
 *          no-upload privacy promise.
 *
 * PROFILE: free-form style/motivation notes. Empty in v0; future facilitator
 *          dashboard writes here.
 *
 * Both layers are injected into the story-generator system prompt so reading
 * payoffs can reference the learner's actual progress and preferred topics.
 */
const pool = require('../db/connection');

// Bound prompt size: long memory inflates token cost and pushes the secular
// rules out of attention. Keep newest entries; drop oldest when over cap.
const SUMMARY_BYTE_CAP = 2048;
const PROFILE_BYTE_CAP = 1024;

async function ensureMemoryRow(learnerId) {
  await pool.query(
    `INSERT INTO bedaya_learner_memory (learner_id) VALUES ($1)
     ON CONFLICT (learner_id) DO NOTHING`,
    [learnerId]
  );
}

async function getMemory(learnerId) {
  const result = await pool.query(
    `SELECT summary, profile, updated_at FROM bedaya_learner_memory WHERE learner_id = $1`,
    [learnerId]
  );
  if (result.rows.length === 0) return { summary: '', profile: '', updatedAt: null };
  return {
    summary: result.rows[0].summary || '',
    profile: result.rows[0].profile || '',
    updatedAt: result.rows[0].updated_at,
  };
}

function trimToCap(text, cap) {
  if (Buffer.byteLength(text, 'utf8') <= cap) return text;
  const lines = text.split('\n');
  while (lines.length > 1 && Buffer.byteLength(lines.join('\n'), 'utf8') > cap) {
    lines.shift();
  }
  return lines.join('\n');
}

async function appendSummaryLine(learnerId, line) {
  await ensureMemoryRow(learnerId);
  const today = new Date().toISOString().slice(0, 10);
  const dated = `${today}: ${line}`;
  const result = await pool.query(
    `SELECT summary FROM bedaya_learner_memory WHERE learner_id = $1`,
    [learnerId]
  );
  const current = result.rows[0]?.summary || '';
  const next = trimToCap(current ? `${current}\n${dated}` : dated, SUMMARY_BYTE_CAP);
  await pool.query(
    `UPDATE bedaya_learner_memory
        SET summary = $1, updated_at = NOW()
      WHERE learner_id = $2`,
    [next, learnerId]
  );
}

async function setProfile(learnerId, profile) {
  await ensureMemoryRow(learnerId);
  const trimmed = trimToCap(profile || '', PROFILE_BYTE_CAP);
  await pool.query(
    `UPDATE bedaya_learner_memory
        SET profile = $1, updated_at = NOW()
      WHERE learner_id = $2`,
    [trimmed, learnerId]
  );
}

/**
 * Render memory as Arabic-language context block for the story generator.
 * Empty layers produce empty output — never pollute the prompt with blanks.
 */
function renderForPrompt({ summary, profile }) {
  const parts = [];
  if (profile && profile.trim()) {
    parts.push(`ملف المتعلم (نمط، اهتمامات):\n${profile.trim()}`);
  }
  if (summary && summary.trim()) {
    parts.push(`سجل تقدم المتعلم (آخر النشاط):\n${summary.trim()}`);
  }
  return parts.join('\n\n');
}

module.exports = {
  getMemory,
  appendSummaryLine,
  setProfile,
  renderForPrompt,
  ensureMemoryRow,
};
