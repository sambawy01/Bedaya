/**
 * Voice engine for Bedaya.
 *
 * The voice IS the interface — a learner who can't read depends entirely on
 * hearing. So this layer:
 *   - picks the best available Egyptian/Arabic voice and slows it down
 *   - waits for the browser to finish loading voices (Chrome loads async)
 *   - unlocks audio on the first user gesture (browsers block autoplay)
 *   - speaks by KEY first, falling back to TTS — so real recorded clips
 *     (the Umm Yasmin / Amm Hassan cast) can drop in later with no caller
 *     changes: just add files to RECORDINGS.
 */

const GUIDE_GENDER = {
  umm_yasmin: 'female',
  amm_hassan: 'male',
};

// When real recordings exist, map key -> { umm_yasmin: url, amm_hassan: url }.
// Empty for now; TTS is the fallback.
const RECORDINGS = {};

let _audioUnlocked = false;

function loadVoicesOnce() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  // Touch getVoices so Chrome starts loading; the voiceschanged event will
  // populate them. We don't need to cache — pickVoice reads fresh each call.
  window.speechSynthesis.getVoices();
}
loadVoicesOnce();

function pickVoice(gender) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const arabic = voices.filter((v) => /^ar(-|_|$)/i.test(v.lang) || /arabic/i.test(v.name));
  if (!arabic.length) return null;

  const egyptian = arabic.filter((v) => /ar-eg/i.test(v.lang) || /egypt/i.test(v.name));
  const pool = egyptian.length ? egyptian : arabic;

  const wantFemale = /female|woman|amira|hala|laila|layla|maryam|sara|salma|noura|hoda|yara/i;
  const wantMale = /male|man|hamed|hassan|tariq|nasser|omar|karim|shakir/i;
  const want = gender === 'female' ? wantFemale : wantMale;

  return pool.find((v) => want.test(v.name)) || pool[0];
}

/**
 * Call from any user gesture (e.g. the first tap) so later auto-speak works.
 * Browsers require a gesture before audio can play.
 */
export function unlockAudio() {
  if (_audioUnlocked || typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    window.speechSynthesis.speak(u);
    _audioUnlocked = true;
  } catch { /* noop */ }
}

/**
 * Speak a line. Accepts a string, or { key, text } so recordings can override.
 *   speak('مرحبا', { guide })
 *   speak({ key: 'welcome', text: 'مرحبا' }, { guide })
 */
export function speak(input, { guide = 'umm_yasmin', rate = 0.72 } = {}) {
  if (typeof window === 'undefined') return;

  const key = typeof input === 'object' && input ? input.key : null;
  const text = typeof input === 'object' && input ? input.text : input;

  const clip = key && RECORDINGS[key]?.[guide];
  if (clip) {
    try {
      const audio = new Audio(clip);
      audio.play().catch(() => {});
      return;
    } catch { /* fall through to TTS */ }
  }

  if (!window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ar-EG';
  utter.rate = rate;      // slower — these are brand-new readers
  utter.pitch = 1;
  const v = pickVoice(GUIDE_GENDER[guide] || 'female');
  if (v) utter.voice = v;
  window.speechSynthesis.speak(utter);
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
