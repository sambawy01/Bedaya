/**
 * Voice helpers. V0 uses Web Speech API with Arabic locale.
 * The two peer guides (Umm Yasmin / Amm Hassan) are matched best-effort
 * to available browser voices — production will swap in real recordings.
 */
const GUIDE_GENDER = {
  umm_yasmin: 'female',
  amm_hassan: 'male',
};

function pickVoice(gender) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const arabic = voices.filter(v => /ar[-_]/i.test(v.lang) || /arabic/i.test(v.name));
  if (arabic.length === 0) return null;
  // Heuristic gender match by voice name
  const want = gender === 'female' ? /female|woman|yara|laila|hala|maryam|sara|noura/i
                                   : /male|man|hamed|hassan|tariq|nasser|omar/i;
  return arabic.find(v => want.test(v.name)) || arabic[0];
}

export function speak(text, { guide = 'umm_yasmin', rate = 0.85 } = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ar-EG';
  utter.rate = rate;
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
