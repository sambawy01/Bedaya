const { z } = require('zod');
const pool = require('../db/connection');
const ai = require('./ai-provider');
const memory = require('./learner-memory');
const scheduler = require('./scheduler');
const { nextLetter, letterInfo, orderFor, FREQUENCY_ORDER } = require('./letters');

// Structural schema only — letter-constraint enforcement stays in validateStory().
const STORY_SCHEMA = z.object({
  story: z.string().min(3).max(400),
});

// Hamza/maddah variants are visually distinct but pedagogically equivalent
// once a learner knows the base letter. We accept all of them when the base
// is allowed so Claude doesn't get penalised for natural Arabic spelling.
const VARIANT_GROUPS = {
  'ا': ['ا', 'أ', 'إ', 'آ'],
  'ي': ['ي', 'ى', 'ئ'],
  'و': ['و', 'ؤ'],
  'ت': ['ت', 'ة'],
};

// Common Arabic punctuation + diacritics learners don't need to "know"
// but appear in natural text.
const ALWAYS_ALLOWED = [
  ' ', '\n', '\t',
  '،', '؛', '؟', '.', '!', '"', "'", ':',
  'ـ',                       // tatweel
  // Harakat — we strip these before validation, never penalise
];

const HARAKAT_REGEX = /[ً-ْٰ]/g;

// Hard secular contract. This text never appears in user-facing UI, but it
// anchors every story we generate. Per the Bedaya brief: literacy only.
const SECULAR_SYSTEM_PROMPT = `أنت مدرّس قراءة وكتابة للكبار في تطبيق "بداية".
مهمتك: تكتب قصصاً قصيرة جداً (سطران أو ثلاثة) بلغة بسيطة جداً ليتدرّب الكبار على القراءة.

قواعد إلزامية:
1. ممنوع تماماً أي محتوى ديني: لا قرآن، لا إنجيل، لا أنبياء، لا مساجد، لا كنائس، لا أعياد دينية، لا رموز دينية، لا أدعية، لا أيات.
2. مواضيع مسموحة فقط: العائلة، البيت، العمل، الجيران، السوق، المواصلات، الصحة، الطعام، الفلاحة، اللُقَى البسيطة.
3. كل كلمة في القصة يجب أن تستخدم فقط الحروف التي تعلّمها المتعلم. لا تستخدم حروفاً غير معروفة.
4. القصة مكتوبة بالفصحى البسيطة جداً، جملة جملة، بأقصر كلمات ممكنة.
5. لا تكتب أي شرح أو مقدمة. القصة فقط. سطران أو ثلاثة سطور كحد أقصى.
6. لا تستخدم تشكيلاً (لا فتحة لا ضمة لا كسرة لا شدة).
7. احترم القارئ الكبير. لا تطفّل الأسلوب.`;

async function createLearner({ name, phone, voiceGuide, letterOrder, deviceId }) {
  const result = await pool.query(
    `INSERT INTO bedaya_learners (name, phone, voice_guide, letter_order, device_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, phone || null, voiceGuide || 'umm_yasmin', letterOrder || 'frequency', deviceId || null]
  );
  return result.rows[0];
}

async function getLearner(id) {
  const result = await pool.query(`SELECT * FROM bedaya_learners WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function getKnownLetters(learnerId) {
  const result = await pool.query(
    `SELECT letter FROM bedaya_letter_progress
      WHERE learner_id = $1 AND status IN ('practising', 'mastered')
      ORDER BY introduced_at ASC`,
    [learnerId]
  );
  return result.rows.map((r) => r.letter);
}

async function getCurrentLetter(learnerId) {
  const result = await pool.query(
    `SELECT letter FROM bedaya_letter_progress
      WHERE learner_id = $1 AND status = 'introduced'
      ORDER BY introduced_at DESC LIMIT 1`,
    [learnerId]
  );
  return result.rows[0]?.letter || null;
}

/**
 * Plan the next lesson for a learner.
 * Returns: { warmup: [knownLetters...], newLetter: {...}, isFirstLesson: bool }
 */
async function planLesson(learnerId) {
  const learner = await getLearner(learnerId);
  if (!learner) throw new Error('learner not found');

  const known = await getKnownLetters(learnerId);
  const inProgress = await getCurrentLetter(learnerId);

  // If a letter is already introduced but not mastered, finish it first.
  let nextL;
  if (inProgress) {
    nextL = letterInfo(inProgress);
  } else {
    nextL = nextLetter(learner.letter_order, known);
  }

  if (!nextL) {
    return { complete: true, warmup: known, learner };
  }

  // FSRS-selected warm-up set sits alongside the legacy full-known list so
  // clients can adopt the spaced-repetition queue at their own pace.
  const warmupScheduled = await scheduler.selectWarmupSet(learnerId, 5);

  return {
    complete: false,
    isFirstLesson: known.length === 0 && !inProgress,
    warmup: known,
    warmupScheduled,
    newLetter: nextL,
    learner,
  };
}

/**
 * Open the lesson on the server. We need the row to track time-on-task and
 * per-phase completion so the home screen can show real progress.
 */
async function startSession(learnerId, letter) {
  // Ensure the letter has a progress row so future steps can update it.
  // letter_id resolved from the canonical letters table — when seeded.
  // Cast $2 explicitly: Postgres can't unify text vs varchar across both uses.
  // RETURNING (xmax = 0) tells us whether THIS call actually inserted, so we
  // log the introduction event to memory exactly once per letter per learner.
  const insert = await pool.query(
    `INSERT INTO bedaya_letter_progress (learner_id, letter, letter_id, status)
     VALUES ($1, $2::varchar, (SELECT id FROM bedaya_letters WHERE glyph = $2::varchar), 'introduced')
     ON CONFLICT (learner_id, letter) DO NOTHING
     RETURNING letter_id, (xmax = 0) AS inserted`,
    [learnerId, letter]
  );
  const justIntroduced = insert.rows[0]?.inserted === true;

  // Resolve letter_id for FSRS card creation — read it back when the upsert
  // was a no-op so we still have the canonical id.
  let letterId = insert.rows[0]?.letter_id;
  if (!letterId) {
    const idRes = await pool.query(
      `SELECT letter_id FROM bedaya_letter_progress WHERE learner_id = $1 AND letter = $2`,
      [learnerId, letter]
    );
    letterId = idRes.rows[0]?.letter_id || null;
  }

  const result = await pool.query(
    `INSERT INTO bedaya_sessions (learner_id, letter) VALUES ($1, $2) RETURNING id, started_at`,
    [learnerId, letter]
  );
  if (justIntroduced) {
    await memory.appendSummaryLine(learnerId, `تم تعريف حرف ${letter}`);
    if (letterId) await scheduler.onLetterIntroduced(learnerId, letterId);
  }
  return result.rows[0];
}

async function markPhase(sessionId, phase, options = {}) {
  const col = { warmup: 'warmup_done', phonics: 'phonics_done', story: 'story_done' }[phase];
  if (!col) throw new Error('invalid phase');
  await pool.query(`UPDATE bedaya_sessions SET ${col} = TRUE WHERE id = $1`, [sessionId]);

  // When the warm-up phase completes and the client supplied which letters
  // were reviewed, rate each card Good so the FSRS schedule moves forward.
  if (phase === 'warmup' && Array.isArray(options.letterIds) && options.letterIds.length > 0) {
    const sess = await pool.query(
      `SELECT learner_id FROM bedaya_sessions WHERE id = $1`,
      [sessionId]
    );
    const learnerId = sess.rows[0]?.learner_id;
    if (learnerId) {
      await scheduler.ratePhaseComplete(learnerId, options.letterIds, 'good');
    }
  }
}

async function recordTrace(learnerId, letter) {
  await pool.query(
    `UPDATE bedaya_letter_progress
        SET trace_count = trace_count + 1,
            status = CASE WHEN status = 'introduced' THEN 'practising' ELSE status END
      WHERE learner_id = $1 AND letter = $2`,
    [learnerId, letter]
  );
}

async function completeSession(sessionId, { masterLetter } = {}) {
  const sess = await pool.query(
    `SELECT learner_id, letter, started_at FROM bedaya_sessions WHERE id = $1`,
    [sessionId]
  );
  if (sess.rows.length === 0) return null;
  const { learner_id, letter } = sess.rows[0];

  await pool.query(
    `UPDATE bedaya_sessions
        SET completed_at = NOW(),
            duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INT
      WHERE id = $1`,
    [sessionId]
  );

  if (masterLetter) {
    await pool.query(
      `UPDATE bedaya_letter_progress
          SET status = 'mastered', mastered_at = NOW()
        WHERE learner_id = $1 AND letter = $2`,
      [learner_id, letter]
    );
    await memory.appendSummaryLine(learner_id, `إتقان حرف ${letter}`);
  } else {
    await memory.appendSummaryLine(learner_id, `إكمال جلسة على حرف ${letter}`);
  }

  await pool.query(
    `UPDATE bedaya_learners
        SET sessions_completed = sessions_completed + 1,
            letters_known = (
              SELECT COUNT(*) FROM bedaya_letter_progress
               WHERE learner_id = $1 AND status = 'mastered'
            ),
            updated_at = NOW()
      WHERE id = $1`,
    [learner_id]
  );

  return getLearner(learner_id);
}

/**
 * Story generator. Hard-constrained to letters the learner has actually
 * been introduced to. We verify the result before returning — any letter
 * outside the allowed set means we drop the response and fall back to a
 * deterministic mini-sentence so the lesson can still finish.
 */
// Collect example words from the letter inventory that are buildable from
// the allowed set (after expansion for hamza variants). Used for early
// lessons before stories are pedagogically viable.
function expandExampleWords(allowed) {
  const { LETTERS } = require('./letters');
  const allowedSet = expandAllowed(allowed);
  const out = [];
  for (const letter of LETTERS) {
    if (!allowed.includes(letter.glyph)) continue;
    for (const word of letter.examples) {
      const chars = word.replace(HARAKAT_REGEX, '').match(/[؀-ۿ]/g) || [];
      if (chars.every((ch) => allowedSet.has(ch))) {
        if (!out.includes(word)) out.push(word);
      }
    }
  }
  return out;
}

function expandAllowed(allowed) {
  const set = new Set(ALWAYS_ALLOWED);
  for (const g of allowed) {
    set.add(g);
    const variants = VARIANT_GROUPS[g];
    if (variants) variants.forEach((v) => set.add(v));
  }
  return set;
}

function disallowedList(allowed) {
  const expandedSet = expandAllowed(allowed);
  return FREQUENCY_ORDER.filter((g) => !expandedSet.has(g));
}

function validateStory(story, allowed) {
  if (!story) return { ok: false, reason: 'empty' };
  const allowedSet = expandAllowed(allowed);
  const stripped = story.replace(HARAKAT_REGEX, '');
  const arabicChars = stripped.match(/[؀-ۿ]/g) || [];
  const invalid = arabicChars.find((ch) => !allowedSet.has(ch));
  if (invalid) return { ok: false, reason: 'invalid_char', invalid };
  if (stripped.length < 3) return { ok: false, reason: 'too_short' };
  return { ok: true };
}

async function generateStory(learnerId, options = {}) {
  const known = await getKnownLetters(learnerId);
  const current = await getCurrentLetter(learnerId);
  const allowed = [...new Set([...known, current].filter(Boolean))];
  if (allowed.length === 0) {
    return { story: 'ا', topic: 'بداية', allowed, fallback: true };
  }

  // Pedagogical reality: meaningful Arabic sentences need 12+ letters
  // because Arabic morphology is rich. Below that, we surface example words
  // from the learned letters — honest scaffolding rather than asking Claude
  // to write under a constraint it can't reliably satisfy.
  // In production, stories at the 12+ letter range are pre-generated and
  // validated offline (per the Bedaya spec); this function is the on-demand path.
  if (allowed.length < 12) {
    const examples = expandExampleWords(allowed);
    // Never show an empty box: fall back to the learned letters themselves
    // (the very first lesson knows one letter and no words are buildable yet).
    const display = examples.length > 0
      ? examples.slice(0, 3).join(' · ')
      : allowed.join(' · ');
    return {
      story: display,
      topic: options.topic || 'كلمات',
      allowed,
      mode: examples.length > 0 ? 'words' : 'letters',
      fallback: false,
    };
  }

  const disallowed = disallowedList(allowed);
  const topic = options.topic || 'حياة يومية بسيطة';

  const prompt = `الحروف المسموحة (يمكنك استخدامها فقط):
${allowed.join(' ، ')}

الحروف الممنوعة (لا تستخدم أياً منها أبداً):
${disallowed.join(' ، ')}

الموضوع: ${topic}.

المطلوب:
- جملة واحدة أو جملتان قصيرتان جداً.
- كل كلمة مكوّنة من الحروف المسموحة فقط.
- لا تستخدم تشكيلاً.
- لا تكتب أي شرح. القصة فقط.
- موضوع علماني تماماً (عائلة، عمل، طعام، صحة، لا دين أبداً).

ابدأ مباشرة بالقصة الآن.`;

  // Prepend learner memory so the story can echo their progress and topics.
  // Empty memory layers contribute nothing — the secular contract stays first.
  const mem = await memory.getMemory(learnerId);
  const memBlock = memory.renderForPrompt(mem);
  const system = memBlock
    ? `${SECULAR_SYSTEM_PROMPT}\n\n${memBlock}`
    : SECULAR_SYSTEM_PROMPT;

  // Up to 3 attempts. Bedaya is offline-first in production; we tolerate
  // a fallback when the model can't satisfy the constraint.
  let lastStory = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    let story = '';
    try {
      const obj = await ai.structured(STORY_SCHEMA, { system, prompt });
      story = (obj?.story || '').trim();
    } catch {
      break;
    }
    lastStory = story;
    const check = validateStory(story, allowed);
    if (check.ok) {
      await pool.query(
        `INSERT INTO bedaya_story_history (learner_id, letters_used, story, topic)
         VALUES ($1, $2, $3, $4)`,
        [learnerId, allowed.join(','), story, options.topic || null]
      );
      return { story, topic: options.topic || null, allowed, fallback: false, attempts: attempt + 1 };
    }
  }

  // All attempts failed validation. Return a deterministic stub.
  const safe = current ? `${current} ${current}.` : allowed[0];
  return {
    story: safe,
    topic: options.topic || 'بداية',
    allowed,
    fallback: true,
    lastRejected: lastStory || null,
  };
}

module.exports = {
  SECULAR_SYSTEM_PROMPT,
  createLearner,
  getLearner,
  getKnownLetters,
  planLesson,
  startSession,
  markPhase,
  recordTrace,
  completeSession,
  generateStory,
};
