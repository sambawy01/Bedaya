/**
 * FSRS-6 backed warm-up scheduler for Bedaya.
 *
 * Each (learner_id, letter_id) is one FSRS card. The warm-up phase pulls the
 * most-overdue cards (state != New) so the learner reviews letters their
 * own forgetting curve says they're about to forget. New cards live in the
 * table but don't surface in warm-up — that's what the phonics phase is for.
 *
 * Rating policy in v0:
 *   - Bedaya only emits a binary signal from warm-up: the learner saw the
 *     letter (Good) or did not finish the phase. We default to Good per card
 *     when the warm-up phase completes, which yields gentle stability growth
 *     without false-positive overconfidence. Task 8 (BKT) will provide a
 *     richer correctness signal per letter that can refine this to Again /
 *     Hard / Easy when the phonics and trace phases land.
 */
const { fsrs, createEmptyCard, Rating, State } = require('ts-fsrs');
const pool = require('../db/connection');

// Default parameters; FSRS-6 ships its own optimised defaults.
const scheduler = fsrs();

function rowToCard(row) {
  if (!row) return null;
  return {
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review: row.last_review || undefined,
  };
}

function cardToParams(letterId, card) {
  return [
    letterId,
    card.due,
    card.stability,
    card.difficulty,
    card.elapsed_days,
    card.scheduled_days,
    card.reps,
    card.lapses,
    card.state,
    card.last_review || null,
  ];
}

async function ensureCard(learnerId, letterId) {
  const existing = await pool.query(
    `SELECT * FROM bedaya_letter_fsrs WHERE learner_id = $1 AND letter_id = $2`,
    [learnerId, letterId]
  );
  if (existing.rows.length > 0) return rowToCard(existing.rows[0]);
  const empty = createEmptyCard();
  const insert = await pool.query(
    `INSERT INTO bedaya_letter_fsrs
       (learner_id, letter_id, due, stability, difficulty, elapsed_days,
        scheduled_days, reps, lapses, state, last_review)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [learnerId, ...cardToParams(letterId, empty)]
  );
  if (insert.rows.length > 0) return rowToCard(insert.rows[0]);
  // Conflict — a concurrent caller (e.g. backfill or another startSession)
  // inserted a card between our SELECT and INSERT. Re-read so callers like
  // rateCard never operate on a stale `empty` while the real state has
  // already advanced.
  const reread = await pool.query(
    `SELECT * FROM bedaya_letter_fsrs WHERE learner_id = $1 AND letter_id = $2`,
    [learnerId, letterId]
  );
  return rowToCard(reread.rows[0]) || empty;
}

/**
 * Pick the warm-up set: cards that are due now, sorted most-overdue first.
 * New cards default to due=NOW() so they surface on their first warm-up.
 * Caller passes max so the home screen can show a fixed-size warm-up panel.
 */
async function selectWarmupSet(learnerId, max = 5) {
  const result = await pool.query(
    `SELECT f.letter_id, l.glyph, l.name_ar, l.name_romanised, l.sound, f.due, f.state
       FROM bedaya_letter_fsrs f
       JOIN bedaya_letters l ON l.id = f.letter_id
      WHERE f.learner_id = $1
        AND f.due <= NOW()
      ORDER BY f.due ASC
      LIMIT $2`,
    [learnerId, max]
  );
  return result.rows.map((r) => ({
    letterId: r.letter_id,
    glyph: r.glyph,
    name: r.name_ar,
    romanised: r.name_romanised,
    sound: r.sound,
    due: r.due,
    state: r.state,
  }));
}

/**
 * Update a card's FSRS state from a rating. Returns the new card.
 * rating: 'again' | 'hard' | 'good' | 'easy'. Default 'good'.
 */
const RATING_MAP = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

async function rateCard(learnerId, letterId, rating = 'good') {
  const currentCard = await ensureCard(learnerId, letterId);
  const rated = scheduler.next(currentCard, new Date(), RATING_MAP[rating] || Rating.Good);
  const next = rated.card;
  await pool.query(
    `UPDATE bedaya_letter_fsrs
        SET due = $3, stability = $4, difficulty = $5,
            elapsed_days = $6, scheduled_days = $7,
            reps = $8, lapses = $9, state = $10, last_review = $11
      WHERE learner_id = $1 AND letter_id = $2`,
    [learnerId, ...cardToParams(letterId, next)]
  );
  return next;
}

/**
 * After warm-up phase completes, rate every shown card as Good (v0 signal).
 * Caller passes the same set selectWarmupSet returned. No-op if empty.
 */
async function ratePhaseComplete(learnerId, letterIds, rating = 'good') {
  for (const letterId of letterIds) {
    await rateCard(learnerId, letterId, rating);
  }
}

/**
 * Register a newly-introduced letter as a New FSRS card (due=NOW, no rating
 * yet). The card surfaces in the next warm-up, and the first rating happens
 * when the learner actually reviews it — that's when FSRS starts scheduling.
 */
async function onLetterIntroduced(learnerId, letterId) {
  await ensureCard(learnerId, letterId);
}

/**
 * Backfill FSRS cards for pre-FSRS learners (and any letter whose card was
 * skipped on a re-attempt). Single-statement bulk upsert — resolves glyph →
 * letter_id and inserts missing cards in one round trip. ts-fsrs's
 * createEmptyCard() is deterministic (due=NOW, all counters 0, state=New) so
 * we can inline its values rather than read them per card.
 */
async function ensureCardsForGlyphs(learnerId, glyphs) {
  if (!glyphs || glyphs.length === 0) return;
  await pool.query(
    `INSERT INTO bedaya_letter_fsrs
       (learner_id, letter_id, due, stability, difficulty, elapsed_days,
        scheduled_days, reps, lapses, state, last_review)
     SELECT $1, l.id, NOW(), 0, 0, 0, 0, 0, 0, 0, NULL
       FROM bedaya_letters l
      WHERE l.glyph = ANY($2::varchar[])
     ON CONFLICT (learner_id, letter_id) DO NOTHING`,
    [learnerId, glyphs]
  );
}

module.exports = {
  ensureCard,
  selectWarmupSet,
  rateCard,
  ratePhaseComplete,
  onLetterIntroduced,
  ensureCardsForGlyphs,
};
