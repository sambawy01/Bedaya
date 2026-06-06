# Lesson session: stop the duplicate intro + add a motivating recap

**Date:** 2026-06-06
**Status:** Approved (pending writing-plans handoff)

## Problem

The lesson session feels like the tutor restarts "today's lesson" on every letter. Two concrete causes:

1. **Duplicate framing on entry.** `HomePage` already announces `home_lesson` ("درس النهاردة جاهز. دوس على الزرار الكبير عشان نبدأ."), then the **phonics phase** on `LessonPage` re-introduces with `phonics_intro_<glyph>` ("ده حرف جديد. اسمه [name]. دوس على الزرار البرتقالي عشان تسمعه."). The learner hears two "this is today's lesson" framings back to back.
2. **Flat closing.** The `done` phase plays a single generic clip `phase_done` ("برافو عليك! خلّصت درس النهاردة.") — no mention of which letter was learned, no acknowledgement of the warmup work, no warm "I'm proud of you / see you tomorrow." When the learner does back-to-back sessions, this same line plays at the end of every letter and feels like a loop.

Today's session model — **one new letter per session**, with a warmup of FSRS-due letters before it — is unchanged.

## Design

### Fix 1 — Replace the phonics phase line

**Current** (`LessonPage.jsx:88-91`):
```js
case 'phonics':
  return newLetter
    ? { key: `phonics_intro_${newLetter.glyph}`, text: `ده حرف جديد. اسمه ${newLetter.name}. دوس على الزرار البرتقالي عشان تسمعه.` }
    : '';
```

**Target behavior:** auto-speak queue plays
1. `letter_<glyph>` — already pre-baked per guide, just the letter name.
2. `phase_phonics_cue` — new static clip per guide: **"دوس على الزرار البرتقالي عشان تسمعه تاني."**

That drops the "ده حرف جديد / اسمه..." framing (the duplicate of `home_lesson`) while keeping the letter name announcement and the action cue.

### Fix 2 — Replace the closing recap

**Current** (`LessonPage.jsx:105-106`):
```js
case 'done':
  return { key: 'phase_done', text: 'برافو عليك! خلّصت درس النهاردة.' };
```

**Target behavior:** auto-speak queue plays
1. `recap_opener` — new static clip per guide: **"برافو عليك! النهاردة اتعلمت حرف..."**
2. `letter_<glyph>` — existing per-letter clip with the new letter's name.
3. `recap_closer` — new static clip per guide: **"وراجعت اللي عرفته قبل كده. أنا فخور بيك. لما ترجع بكرة هنكمل."**

The opener leaves an open `حرف...` so the queued `letter_<glyph>` lands as the completion of the sentence ("the letter [name]"). This gives a personalized 3-clip motivating recap composed entirely from per-guide ElevenLabs clips — no browser TTS fallback.

### Auto-speak: from single-clip to clip-queue per phase

`LessonPage`'s `phaseLine()` currently returns a single `{ key, text }` and the phase-change `useEffect` calls `speak(line, { guide, queueAfterCurrent: true })` once.

**Change:** `phaseLine()` returns either a `{ key, text }` (single-clip phases) **or** a `{ sequence: [{ key, text }, …] }` (multi-clip phases). The phase-change `useEffect` plays sequences by calling `speak` once per item, all with `queueAfterCurrent: true` so the voice queue chains them without overlap.

Phases that stay single-clip: `warmup`, `trace`, `story`.
Phases that become sequences: `phonics`, `done`.

The `ListenButton` in the header bar (currently `<ListenButton line={phaseLine()} />`) replays whatever the current phase is. For sequence phases, tapping replay re-queues the full sequence.

### Voice generation

Add to `STATIC_PHRASE_KEYS` in `client/src/lib/voice.js`:
- `phase_phonics_cue`
- `recap_opener`
- `recap_closer`

Add to `scripts/generate-voice-clips-elevenlabs.mjs` static phrase table:
- `phase_phonics_cue`: "دوس على الزرار البرتقالي عشان تسمعه تاني."
- `recap_opener`: "برافو عليك! النهاردة اتعلمت حرف..."
- `recap_closer`: "وراجعت اللي عرفته قبل كده. أنا فخور بيك. لما ترجع بكرة هنكمل."

Generate for both guides (`umm_yasmin`, `amm_hassan`). 3 phrases × 2 guides = 6 new MP3 files committed under `client/public/audio/voice/<guide>/`.

`phonics_intro_<glyph>` clips become unused — leave them in place for now (no harm, and reverting is trivial). Removing them is a follow-up cleanup task, not part of this change.

## Files affected

- `client/src/pages/LessonPage.jsx` — `phaseLine()` return shape; phase-change `useEffect` sequence playback; `ListenButton` replay handler.
- `client/src/lib/voice.js` — add three keys to `STATIC_PHRASE_KEYS`.
- `scripts/generate-voice-clips-elevenlabs.mjs` — add three phrase entries.
- `client/public/audio/voice/umm_yasmin/{phase_phonics_cue,recap_opener,recap_closer}.mp3` — generated.
- `client/public/audio/voice/amm_hassan/{phase_phonics_cue,recap_opener,recap_closer}.mp3` — generated.

## Out of scope

- Multi-letter sessions. Session model stays one-new-letter; the recap will reference that one letter by name.
- Removing the now-unused `phonics_intro_<glyph>` clips and their generation entries. Follow-up cleanup.
- Per-letter recap variants (e.g., 30 unique `recap_<glyph>` clips) — overkill; the 3-part composition already names the letter.
- Server-side changes. `/lessons/complete` already returns enough; no new fields needed since the client knows `plan.newLetter` for the recap.

## Edge cases

- **No warmup this session** (first-time learner, `warmupItems` empty): the recap_closer still says "وراجعت اللي عرفته قبل كده" — a mild over-claim on day one. Accepted — the simpler single-string closer outweighs branching to a variant.
- **User taps Home during recap:** existing `stopSpeaking()` on the Home button path cancels the queue mid-sequence. No change needed.
- **ListenButton replay during phonics:** re-queues the full `letter_<glyph>` → `phase_phonics_cue` sequence, matching the initial auto-speak. The existing `speak()` clears the queue on a user-initiated tap (`queueAfterCurrent` is false by default), then we re-queue. Confirm the new replay handler does that explicit clear before re-queueing.

## Testing

- **Unit/manual:** open the lesson, verify phonics phase plays letter name then cue (no "ده حرف جديد"). Reach done phase, verify 3-clip recap plays in order with the correct letter name in the middle.
- **Per-guide:** repeat for both `umm_yasmin` and `amm_hassan` so we catch any missing or mis-named MP3 for one guide.
- **Replay button:** tap the header listen button during phonics and during done; both should replay the full sequence.
- **Back-to-back sessions:** complete two lessons in a row; confirm the second session's recap names the new letter (not the previous one) and feels distinct from the first.
