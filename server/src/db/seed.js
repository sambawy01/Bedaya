/**
 * Idempotent seed for the Antura-style letter data model.
 * Run automatically by migrate.js after schema.sql; can be re-run safely.
 *
 * Pulls from services/letters.js as the single source of truth, so the JS
 * LETTERS array stays canonical and the DB is derived.
 */
const { LETTERS } = require('../services/letters');

// ا is the only true vowel letter; و and ي are consonants that double as
// long-vowel markers and stay consonants here (matches what learners see).
// ء (hamza) and ة (taa marbuta) classify as 'symbol' — modelled as
// first-class letters but neither pure consonants nor vowels in the
// pedagogy.
const VOWEL_GLYPHS = new Set(['ا']);
const SYMBOL_GLYPHS = new Set(['ء', 'ة']);

async function seed(client) {
  await client.query('BEGIN');
  try {
    for (let i = 0; i < LETTERS.length; i++) {
      const l = LETTERS[i];
      const letterType = VOWEL_GLYPHS.has(l.glyph)
        ? 'vowel'
        : SYMBOL_GLYPHS.has(l.glyph)
          ? 'symbol'
          : 'consonant';
      const sortId = i; // LETTERS array is in MOE/alphabetic order.
      await client.query(
        `INSERT INTO bedaya_letters (glyph, name_ar, name_romanised, sound, letter_type, sort_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (glyph) DO UPDATE SET
           name_ar = EXCLUDED.name_ar,
           name_romanised = EXCLUDED.name_romanised,
           sound = EXCLUDED.sound,
           letter_type = EXCLUDED.letter_type,
           sort_id = EXCLUDED.sort_id`,
        [l.glyph, l.name, l.romanised, l.sound, letterType, sortId]
      );
    }

    // Seed example words tagged to their primary letter.
    for (const l of LETTERS) {
      const idRes = await client.query(
        `SELECT id FROM bedaya_letters WHERE glyph = $1`,
        [l.glyph]
      );
      const primaryId = idRes.rows[0]?.id;
      if (!primaryId) continue;
      for (const word of l.examples) {
        await client.query(
          `INSERT INTO bedaya_words (word, primary_letter_id)
           VALUES ($1, $2)
           ON CONFLICT (word) DO NOTHING`,
          [word, primaryId]
        );
      }
    }

    // Backfill letter_id on legacy progress rows so downstream tasks can rely
    // on the FK being populated for every row.
    await client.query(
      `UPDATE bedaya_letter_progress p
          SET letter_id = l.id
         FROM bedaya_letters l
        WHERE p.letter_id IS NULL
          AND p.letter = l.glyph`
    );

    await client.query('COMMIT');
    const count = await client.query(`SELECT COUNT(*)::INT AS n FROM bedaya_letters`);
    const words = await client.query(`SELECT COUNT(*)::INT AS n FROM bedaya_words`);
    console.log(`Seeded: ${count.rows[0].n} letters, ${words.rows[0].n} words.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

module.exports = { seed };
