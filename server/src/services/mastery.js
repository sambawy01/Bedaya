/**
 * Bayesian Knowledge Tracing for letter mastery (OATutor pattern, MIT).
 *
 * Standard 4-parameter BKT per (learner, letter):
 *   L0 — prior probability the skill is known before any observation
 *   T  — transition: P(skill becomes known | not known) per attempt
 *   G  — guess: P(correct observation | not known)
 *   S  — slip:  P(incorrect observation | known)
 *
 * Update (per attempt with observation `correct`):
 *   posterior given obs:
 *     P(L | correct)   = P(L)(1 - S) / (P(L)(1 - S) + (1 - P(L)) G)
 *     P(L | incorrect) = P(L) S      / (P(L) S      + (1 - P(L))(1 - G))
 *   then transition:
 *     P(L_next) = P(L | obs) + (1 - P(L | obs)) * T
 *
 * Bedaya v0 only emits positive signals (engagement with trace / story /
 * phonics phases). The math still works — every signal nudges p upward —
 * and the model is ready for genuine incorrect signals when phonics
 * recognition and trace grading land.
 */
const pool = require('../db/connection');

const L0 = 0.1;   // Prior
const T  = 0.2;   // Transition
const G  = 0.1;   // Guess
const S  = 0.1;   // Slip

const MASTERY_THRESHOLD = 0.95;
const MIN_REPS_FOR_MASTERY = 3;

function bktUpdate(prior, correct) {
  let posterior;
  if (correct) {
    const num = prior * (1 - S);
    const den = num + (1 - prior) * G;
    posterior = den > 0 ? num / den : prior;
  } else {
    const num = prior * S;
    const den = num + (1 - prior) * (1 - G);
    posterior = den > 0 ? num / den : prior;
  }
  return posterior + (1 - posterior) * T;
}

async function getMastery(learnerId, letter) {
  const result = await pool.query(
    `SELECT p_mastered, bkt_reps, status
       FROM bedaya_letter_progress
      WHERE learner_id = $1 AND letter = $2`,
    [learnerId, letter]
  );
  if (result.rows.length === 0) return { p: L0, reps: 0, status: null };
  const row = result.rows[0];
  return { p: row.p_mastered, reps: row.bkt_reps, status: row.status };
}

/**
 * Apply one BKT observation. Returns the updated state and whether the
 * letter just crossed the promotion threshold (caller can persist mastery).
 */
async function recordSignal(learnerId, letter, correct) {
  const current = await getMastery(learnerId, letter);
  const nextP = bktUpdate(current.p, correct);
  const nextReps = current.reps + 1;
  const justMastered =
    current.status !== 'mastered' &&
    nextP >= MASTERY_THRESHOLD &&
    nextReps >= MIN_REPS_FOR_MASTERY;

  await pool.query(
    `UPDATE bedaya_letter_progress
        SET p_mastered = $3,
            bkt_reps = $4,
            status = CASE
              WHEN $5::boolean THEN 'mastered'
              WHEN status = 'introduced' THEN 'practising'
              ELSE status
            END,
            mastered_at = CASE
              WHEN $5::boolean AND mastered_at IS NULL THEN NOW()
              ELSE mastered_at
            END
      WHERE learner_id = $1 AND letter = $2`,
    [learnerId, letter, nextP, nextReps, justMastered]
  );

  return { p: nextP, reps: nextReps, justMastered };
}

module.exports = {
  L0,
  MASTERY_THRESHOLD,
  MIN_REPS_FOR_MASTERY,
  bktUpdate,
  getMastery,
  recordSignal,
};
