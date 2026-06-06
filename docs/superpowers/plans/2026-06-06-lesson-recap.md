# Lesson Recap + Phonics Intro De-Duplication — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-06-06-lesson-recap-design.md`

**Goal:** Stop the lesson screen from re-introducing "today's lesson" on the phonics phase, and replace the flat "خلّصت درس النهاردة" closing with a 3-clip motivating recap that names the specific letter learned.

**Architecture:** Extend the existing pre-baked ElevenLabs voice clip system with 3 new static phrases (`phase_phonics_cue`, `recap_opener`, `recap_closer`) per guide. Change `LessonPage.phaseLine()` so the `phonics` and `done` phases return a `{ sequence: [...] }` of clips instead of a single line. Add a `playLine()` helper in `voice.js` that handles both single lines and sequences, queue-chaining the sequence items.

**Tech Stack:** React 19 (Vite), framer-motion, ElevenLabs (`eleven_multilingual_v2`) for voice generation. No automated test framework exists in this project — verification is manual via browser playback on the dev server.

---

## File Structure

| File | Role | Change |
|------|------|--------|
| `scripts/generate-voice-clips-elevenlabs.mjs` | Pre-bakes ElevenLabs MP3s for static phrases. | Add 3 entries to `PHRASES`. |
| `client/src/lib/voice.js` | Voice queue, recording registry, `speak()`. | Add 3 keys to `STATIC_PHRASE_KEYS`; export new `playLine()` helper. |
| `client/src/pages/LessonPage.jsx` | Lesson session screen. | `phaseLine()` returns sequence for phonics/done; phase-change `useEffect` uses `playLine`. |
| `client/src/components/ListenButton.jsx` | Replay button on every screen. | Use `playLine` so replay handles sequences. |
| `client/public/audio/voice/umm_yasmin/{phase_phonics_cue,recap_opener,recap_closer}.mp3` | Generated audio. | 3 new files (female guide). |
| `client/public/audio/voice/amm_hassan/{phase_phonics_cue,recap_opener,recap_closer}.mp3` | Generated audio. | 3 new files (male guide). |

Each file change is independently committable. Tasks ordered so each commit leaves the app in a working state (e.g., voice keys registered before the LessonPage starts requesting them).

---

## Task 1 — Add new static phrase entries to the generator

**Files:**
- Modify: `scripts/generate-voice-clips-elevenlabs.mjs:37-53` (the `PHRASES` const)

- [ ] **Step 1: Edit `PHRASES` to add three keys**

In `scripts/generate-voice-clips-elevenlabs.mjs`, locate the `PHRASES` const (currently lines 37-53) and add the three new keys at the end of the object literal, just before the closing `};`:

```js
const PHRASES = {
  welcome:               'أهلاً بيك. هنا هنتعلّم نقرا ونكتب مع بعض. دوس على الزرار الكبير عشان نبدأ.',
  pick_guide:            'اختار الصوت اللي يعجبك. دوس على الصورة عشان تسمعه.',
  say_name:              'دلوقتي قول اسمك. دوس على الزرار وقول اسمك.',
  home_lesson:           'درس النهاردة جاهز. دوس على الزرار الكبير عشان نبدأ.',
  home_done:             'برافو عليك. خلّصت كل الحروف.',
  phase_warmup:          'دي الحروف اللي عرفتها. دوس على أي حرف عشان تسمعه. بعدين دوس الزرار الأخضر عشان نكمل.',
  phase_trace:           'دلوقتي اكتب الحرف بإصبعك فوق الخط.',
  phase_story_words:     'دي كلمات فيها بس الحروف اللي عرفتها. دوس عليها عشان تسمعها.',
  phase_story_letters:   'برافو! ده أول حرف. الكلمات هتيجي بعد حروف أكتر.',
  phase_story_normal:    'دي قصة قصيرة. دوس عشان تسمعها.',
  phase_story_loading:   'لحظة صغيرة.',
  phase_done:            'برافو عليك! خلّصت درس النهاردة.',
  error_signup:          'حصل خطأ صغير. حاول تاني.',
  error_lesson:          'حصل خطأ. ارجع للرئيسية.',
  phase_phonics_cue:     'دوس على الزرار البرتقالي عشان تسمعه تاني.',
  recap_opener:          'برافو عليك! النهاردة اتعلمت حرف...',
  recap_closer:          'وراجعت اللي عرفته قبل كده. أنا فخور بيك. لما ترجع بكرة هنكمل.',
};
```

Leave `phase_done` in place. It remains a valid clip; we just stop calling it from `LessonPage`. Removing it is a follow-up cleanup task and is out of scope for this plan.

- [ ] **Step 2: Commit the script change**

```bash
git add scripts/generate-voice-clips-elevenlabs.mjs
git commit -m "Register new lesson recap phrases for ElevenLabs generation"
```

---

## Task 2 — Generate the six new MP3 files

This step requires the user's ElevenLabs credentials. The script is **idempotent** — it skips files that already exist, so this run will only synthesize the three new keys × two guides = 6 files. Existing clips are untouched.

**Files (generated):**
- Create: `client/public/audio/voice/umm_yasmin/phase_phonics_cue.mp3`
- Create: `client/public/audio/voice/umm_yasmin/recap_opener.mp3`
- Create: `client/public/audio/voice/umm_yasmin/recap_closer.mp3`
- Create: `client/public/audio/voice/amm_hassan/phase_phonics_cue.mp3`
- Create: `client/public/audio/voice/amm_hassan/recap_opener.mp3`
- Create: `client/public/audio/voice/amm_hassan/recap_closer.mp3`

- [ ] **Step 1: Run the generator with credentials**

The user runs this in their terminal (env vars stay in their shell, never in the transcript):

```bash
ELEVENLABS_API_KEY='<their-key>' \
  ELEVENLABS_VOICE_UMM_YASMIN='<voice-id>' \
  ELEVENLABS_VOICE_AMM_HASSAN='<voice-id>' \
  node scripts/generate-voice-clips-elevenlabs.mjs
```

Expected output (abbreviated — every existing key prints `(skip, exists)`; the new ones print byte counts):

```
  umm_yasmin/phase_phonics_cue.mp3  ~10,000 bytes
  umm_yasmin/recap_opener.mp3  ~8,000 bytes
  umm_yasmin/recap_closer.mp3  ~18,000 bytes
  amm_hassan/phase_phonics_cue.mp3  ~10,000 bytes
  amm_hassan/recap_opener.mp3  ~8,000 bytes
  amm_hassan/recap_closer.mp3  ~18,000 bytes

Done. 6 files, XX.X KB total.
```

- [ ] **Step 2: Verify the six new files exist**

```bash
ls -la client/public/audio/voice/umm_yasmin/{phase_phonics_cue,recap_opener,recap_closer}.mp3 \
       client/public/audio/voice/amm_hassan/{phase_phonics_cue,recap_opener,recap_closer}.mp3
```

Expected: all six files present, each non-zero size.

- [ ] **Step 3: Spot-listen to one clip per guide**

```bash
afplay client/public/audio/voice/umm_yasmin/recap_opener.mp3
afplay client/public/audio/voice/amm_hassan/recap_opener.mp3
```

Expected: both clips play cleanly, voice matches the guide, Egyptian Arabic pronunciation correct, no truncation or noise.

- [ ] **Step 4: Commit the new audio files**

```bash
git add client/public/audio/voice/umm_yasmin/phase_phonics_cue.mp3 \
        client/public/audio/voice/umm_yasmin/recap_opener.mp3 \
        client/public/audio/voice/umm_yasmin/recap_closer.mp3 \
        client/public/audio/voice/amm_hassan/phase_phonics_cue.mp3 \
        client/public/audio/voice/amm_hassan/recap_opener.mp3 \
        client/public/audio/voice/amm_hassan/recap_closer.mp3
git commit -m "Add ElevenLabs MP3s for phonics cue + 3-part lesson recap"
```

---

## Task 3 — Register the new keys in `voice.js`

**Files:**
- Modify: `client/src/lib/voice.js:57-65` (the `STATIC_PHRASE_KEYS` const)

- [ ] **Step 1: Add the three keys**

Edit `STATIC_PHRASE_KEYS` so it reads:

```js
const STATIC_PHRASE_KEYS = [
  'welcome', 'pick_guide', 'say_name',
  'home_lesson', 'home_done',
  'phase_warmup', 'phase_trace',
  'phase_story_words', 'phase_story_letters', 'phase_story_normal', 'phase_story_loading',
  'phase_done',
  'phase_phonics_cue',
  'recap_opener', 'recap_closer',
  'error_signup', 'error_lesson',
];
```

This is what gives `RECORDINGS['phase_phonics_cue']` a per-guide URL — without this addition, `speak({ key: 'phase_phonics_cue', text: '...' })` would fall through to browser TTS.

- [ ] **Step 2: Verify the dev server still boots**

```bash
cd client && npm run dev
```

Expected: Vite starts, no build errors. Press Ctrl+C after confirming.

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/voice.js
git commit -m "Register phase_phonics_cue + recap_opener/closer in voice registry"
```

---

## Task 4 — Add a `playLine` helper to `voice.js`

`playLine` accepts either a single line (`string` or `{ key, text }`) or a `{ sequence: [line, line, ...] }`. For a sequence it calls `speak()` once per item with `queueAfterCurrent: true` for all items after the first (the first item respects the caller's `queueAfterCurrent`). This is the single place that knows about sequences — both the LessonPage `useEffect` and `ListenButton` go through it.

**Files:**
- Modify: `client/src/lib/voice.js` (append after the existing `speak` export)

- [ ] **Step 1: Append the helper**

After the closing of the `speak` function in `client/src/lib/voice.js`, add this export:

```js
/**
 * Play a line that may be a single clip or a sequence.
 *  - string:                       single clip (falls through to TTS if no recording).
 *  - { key, text }:                single clip.
 *  - { sequence: [line, line] }:   chain via queueAfterCurrent so they play in order.
 *
 * `queueAfterCurrent` from the caller applies to the first item; every subsequent
 * item is queued regardless so the sequence stays contiguous.
 */
export function playLine(line, { guide, queueAfterCurrent = false } = {}) {
  if (!line) return;
  if (Array.isArray(line.sequence)) {
    line.sequence.forEach((part, i) => {
      speak(part, { guide, queueAfterCurrent: queueAfterCurrent || i > 0 });
    });
    return;
  }
  speak(line, { guide, queueAfterCurrent });
}
```

- [ ] **Step 2: Verify build**

```bash
cd client && npm run build
```

Expected: build succeeds, no type/syntax errors. (Existing callers of `speak` are unaffected; we've only added an export.)

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/voice.js
git commit -m "Add playLine helper for single-clip or sequence playback"
```

---

## Task 5 — Switch `ListenButton` to `playLine`

**Files:**
- Modify: `client/src/components/ListenButton.jsx:1-34`

- [ ] **Step 1: Replace `speak` import + call with `playLine`**

Change the file to:

```jsx
import { motion } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import { playLine, unlockAudio } from '../lib/voice';
import { useGuide } from '../context/GuideContext';

/**
 * Big, always-present "listen again" button. For a learner who can't read,
 * this is the lifeline on every screen: tap it to hear the instruction again.
 * Also unlocks audio on first use so subsequent auto-speak works.
 *
 * `line` may be a string, { key, text }, or { sequence: [line, line, ...] }.
 */
export default function ListenButton({ line, size = 'md', className = '' }) {
  const { guide } = useGuide();
  const dims = size === 'lg' ? 'w-20 h-20' : 'w-14 h-14';
  const icon = size === 'lg' ? 34 : 24;

  function play() {
    unlockAudio();
    playLine(line, { guide });
  }

  return (
    <motion.button
      type="button"
      onClick={play}
      whileTap={{ scale: 0.92 }}
      aria-label="استمع مرة أخرى"
      className={`${dims} rounded-full bg-[var(--color-bedaya-clay)] text-white shadow-md flex items-center justify-center ${className}`}
    >
      <Volume2 size={icon} />
    </motion.button>
  );
}
```

`playLine` without `queueAfterCurrent` defaults to `false`, so a tap interrupts whatever was playing and starts the sequence fresh — the existing behavior for single-clip callers, plus correct behavior for sequences.

- [ ] **Step 2: Verify build**

```bash
cd client && npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ListenButton.jsx
git commit -m "Route ListenButton through playLine so replay handles sequences"
```

---

## Task 6 — Update `LessonPage` `phaseLine()` and auto-speak

**Files:**
- Modify: `client/src/pages/LessonPage.jsx:8` (import)
- Modify: `client/src/pages/LessonPage.jsx:84-110` (`phaseLine`)
- Modify: `client/src/pages/LessonPage.jsx:117-131` (auto-speak `useEffect`)

- [ ] **Step 1: Import `playLine`**

Change the existing import line on `LessonPage.jsx:8`:

```jsx
import { speak, stopSpeaking, unlockAudio } from '../lib/voice';
```

to:

```jsx
import { speak, stopSpeaking, unlockAudio, playLine } from '../lib/voice';
```

`speak` stays imported — the warmup grid and the phonics example-word buttons call it directly.

- [ ] **Step 2: Rewrite `phaseLine()` so phonics and done return sequences**

Replace the existing `phaseLine` (LessonPage.jsx:84-110) with:

```jsx
const phaseLine = useCallback(() => {
  switch (phase) {
    case 'warmup':
      return { key: 'phase_warmup', text: 'دي الحروف اللي عرفتها. دوس على أي حرف عشان تسمعه. بعدين دوس الزرار الأخضر عشان نكمل.' };
    case 'phonics':
      // Two-clip sequence: the letter name (existing per-glyph clip) followed
      // by an action cue. Replaces the old phonics_intro_<glyph> single clip
      // which re-introduced "this is today's lesson" after HomePage already
      // framed it.
      return newLetter
        ? {
            sequence: [
              { key: `letter_${newLetter.glyph}`, text: newLetter.glyph },
              { key: 'phase_phonics_cue', text: 'دوس على الزرار البرتقالي عشان تسمعه تاني.' },
            ],
          }
        : '';
    case 'trace':
      return { key: 'phase_trace', text: 'دلوقتي اكتب الحرف بإصبعك فوق الخط.' };
    case 'story':
      // Stay silent while the AI story is loading — the visual placeholder
      // 'لحظة…' on screen already signals waiting.
      if (!story) return '';
      return story.mode === 'words'
        ? { key: 'phase_story_words', text: 'دي كلمات فيها بس الحروف اللي عرفتها. دوس عليها عشان تسمعها.' }
        : story.mode === 'letters'
        ? { key: 'phase_story_letters', text: 'برافو! ده أول حرف. الكلمات هتيجي بعد حروف أكتر.' }
        : { key: 'phase_story_normal', text: 'دي قصة قصيرة. دوس عشان تسمعها.' };
    case 'done':
      // Three-clip motivating recap: opener leaves "حرف..." open so the
      // letter_<glyph> clip lands as the sentence completion, then a warm
      // closer that acknowledges the warmup and sets up tomorrow.
      return newLetter
        ? {
            sequence: [
              { key: 'recap_opener', text: 'برافو عليك! النهاردة اتعلمت حرف...' },
              { key: `letter_${newLetter.glyph}`, text: newLetter.glyph },
              { key: 'recap_closer', text: 'وراجعت اللي عرفته قبل كده. أنا فخور بيك. لما ترجع بكرة هنكمل.' },
            ],
          }
        : { key: 'phase_done', text: 'برافو عليك! خلّصت درس النهاردة.' };
    default:
      return '';
  }
}, [phase, newLetter, story]);
```

The `done` fallback to `phase_done` covers the rare path where `phase === 'done'` is set before `plan.newLetter` has loaded (e.g., when `/lessons/next` returns `complete: true` and LessonPage jumps straight to `done` at line 40). In that case there's no letter to name, so the original single clip is the right thing to play.

- [ ] **Step 3: Update the auto-speak `useEffect` to use `playLine`**

Replace LessonPage.jsx:117-131:

```jsx
useEffect(() => {
  if (phase === 'idle') return;
  const fingerprint = `${phase}:${story?.mode || ''}:${storyLoading}`;
  if (spokenPhase.current === fingerprint) return;
  spokenPhase.current = fingerprint;
  const line = phaseLine();
  if (!line) return;
  // queueAfterCurrent so the prior phase's clip plays to completion before
  // we kick off the new phase's narration — no mid-sentence cutoffs on
  // user-driven advance. User-initiated taps (ListenButton, Volume) still
  // interrupt because they don't pass this flag.
  const t = setTimeout(() => { playLine(line, { guide, queueAfterCurrent: true }); }, 350);
  return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [phase, story, storyLoading]);
```

Only the inner `speak(line, ...)` call became `playLine(line, ...)`. Sequence handling lives in `playLine`.

- [ ] **Step 4: Verify build**

```bash
cd client && npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/LessonPage.jsx
git commit -m "Replace duplicate phonics intro + flat done line with audio sequences"
```

---

## Task 7 — Manual verification on the dev server

There's no automated test framework for this client. Verify by running the app and listening.

- [ ] **Step 1: Start the dev server**

```bash
cd client && npm run dev
```

Note the local URL (e.g., `http://localhost:5173`).

- [ ] **Step 2: Walk through one full lesson with the default guide**

In a browser:
1. Sign up / open the app as a learner.
2. On the Home screen, confirm `home_lesson` plays ("درس النهاردة جاهز…").
3. Tap the big button → land on `warmup` phase. Confirm `phase_warmup` plays.
4. Tap the green continue → land on `phonics`.

   **Expected:** the tutor plays the **letter name** (e.g., "باء"), then the cue **"دوس على الزرار البرتقالي عشان تسمعه تاني."** — **not** "ده حرف جديد. اسمه...".

5. Tap the orange Volume button → just the letter name plays.
6. Tap the listen-again button in the header bar → the full phonics sequence (letter + cue) replays.
7. Tap the green continue → trace → finish trace → story → tap checkmark to finish.

   **Expected at `done`:** the tutor plays the **3-clip recap** in this order:
   - "برافو عليك! النهاردة اتعلمت حرف..."
   - `<letter name>` (e.g., "باء")
   - "وراجعت اللي عرفته قبل كده. أنا فخور بيك. لما ترجع بكرة هنكمل."

   No "خلّصت درس النهاردة" anywhere.

- [ ] **Step 3: Repeat with the other guide**

Switch the guide (settings / re-signup with the other voice) and run the same lesson. Confirm the same three clips play but in the other voice. This catches the case where one of the six MP3s is missing or misnamed.

- [ ] **Step 4: Back-to-back sessions**

Complete one lesson, return to Home, start a new lesson. Run to `done`.

   **Expected:** the second session's recap names the **new** letter (not the previous one). The two recaps feel distinct because the middle clip is different.

- [ ] **Step 5: Tap-replay during recap**

Reach the `done` phase, then tap the header listen-again button while or after the recap plays.

   **Expected:** the full 3-clip recap replays from the top, in order. The user-initiated tap interrupts the queue, then re-queues the sequence (because `playLine` with default `queueAfterCurrent: false` interrupts, and subsequent items chain).

- [ ] **Step 6: No regression on other phases**

Confirm `phase_warmup`, `phase_trace`, and `phase_story_*` all still play as before — they remain single-clip return values and weren't touched.

---

## Out of Scope

These would be follow-up plans:
- Remove the now-unused `phonics_intro_<glyph>` generation entries and their 60 MP3s.
- Remove the unused `phase_done` clip after we're confident the new recap is correct.
- Branch `recap_closer` for the rare first-session case (no warmup yet). The single string slightly over-claims on day one; accepted for now.
- Server changes to `/lessons/complete`. Not needed — the client already has `plan.newLetter`.
