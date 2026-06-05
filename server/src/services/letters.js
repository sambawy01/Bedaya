/**
 * Arabic letter inventory + ordering for Bedaya.
 *
 * Two orders are supported:
 *   - 'frequency' (default) — high-utility letters first so learners can
 *     read meaningful words within a few sessions.
 *   - 'moe'                 — the traditional alphabetic order required for
 *     MOE-branded deployments.
 *
 * Each entry carries enough metadata for the lesson engine: the glyph itself,
 * its name in Arabic, the romanised name (for non-Arabic-speaking devs / logs),
 * the consonant/vowel sound, and a handful of safe example words.
 *
 * SECURITY-OF-MEANING: example words and any future content are STRICTLY
 * SECULAR per the Bedaya brief. No religious words, no religious figures.
 */

const LETTERS = [
  { glyph: 'ا', name: 'ألف',  romanised: 'alif',  sound: 'aa', examples: ['أم', 'باب', 'ماء'] },
  { glyph: 'ب', name: 'باء',  romanised: 'baa',   sound: 'b',  examples: ['باب', 'بنت', 'بيت'] },
  { glyph: 'ت', name: 'تاء',  romanised: 'taa',   sound: 't',  examples: ['تين', 'بيت', 'توت'] },
  { glyph: 'ث', name: 'ثاء',  romanised: 'thaa',  sound: 'th', examples: ['ثوب', 'ثلج'] },
  { glyph: 'ج', name: 'جيم',  romanised: 'jiim',  sound: 'j',  examples: ['جمل', 'جسر'] },
  { glyph: 'ح', name: 'حاء',  romanised: 'haa',   sound: 'H',  examples: ['حقل', 'حليب'] },
  { glyph: 'خ', name: 'خاء',  romanised: 'khaa',  sound: 'kh', examples: ['خبز', 'خيمة'] },
  { glyph: 'د', name: 'دال',  romanised: 'daal',  sound: 'd',  examples: ['دار', 'يد'] },
  { glyph: 'ذ', name: 'ذال',  romanised: 'dhaal', sound: 'dh', examples: ['ذرة', 'ذيل'] },
  { glyph: 'ر', name: 'راء',  romanised: 'raa',   sound: 'r',  examples: ['رجل', 'مطر'] },
  { glyph: 'ز', name: 'زاي',  romanised: 'zaay',  sound: 'z',  examples: ['زيت', 'زهرة'] },
  { glyph: 'س', name: 'سين',  romanised: 'siin',  sound: 's',  examples: ['سوق', 'سمك'] },
  { glyph: 'ش', name: 'شين',  romanised: 'shiin', sound: 'sh', examples: ['شمس', 'شاي'] },
  { glyph: 'ص', name: 'صاد',  romanised: 'Saad',  sound: 'S',  examples: ['صباح', 'صورة'] },
  { glyph: 'ض', name: 'ضاد',  romanised: 'Daad',  sound: 'D',  examples: ['ضوء', 'ضيف'] },
  { glyph: 'ط', name: 'طاء',  romanised: 'Taa',   sound: 'T',  examples: ['طريق', 'طبيب'] },
  { glyph: 'ظ', name: 'ظاء',  romanised: 'Zaa',   sound: 'Z',  examples: ['ظل', 'ظهر'] },
  { glyph: 'ع', name: 'عين',  romanised: 'ayn',   sound: '3',  examples: ['عمل', 'عين'] },
  { glyph: 'غ', name: 'غين',  romanised: 'ghayn', sound: 'gh', examples: ['غيم', 'غداء'] },
  { glyph: 'ف', name: 'فاء',  romanised: 'faa',   sound: 'f',  examples: ['فول', 'فيل'] },
  { glyph: 'ق', name: 'قاف',  romanised: 'qaaf',  sound: 'q',  examples: ['قلم', 'قمر'] },
  { glyph: 'ك', name: 'كاف',  romanised: 'kaaf',  sound: 'k',  examples: ['كتاب', 'كرسي'] },
  { glyph: 'ل', name: 'لام',  romanised: 'laam',  sound: 'l',  examples: ['ليل', 'ليمون'] },
  { glyph: 'م', name: 'ميم',  romanised: 'miim',  sound: 'm',  examples: ['ماء', 'مدرسة'] },
  { glyph: 'ن', name: 'نون',  romanised: 'nuun',  sound: 'n',  examples: ['نهر', 'نخلة'] },
  { glyph: 'ه', name: 'هاء',  romanised: 'haah',  sound: 'h',  examples: ['هواء', 'نهر'] },
  { glyph: 'و', name: 'واو',  romanised: 'waaw',  sound: 'w',  examples: ['ورد', 'دواء'] },
  { glyph: 'ي', name: 'ياء',  romanised: 'yaa',   sound: 'y',  examples: ['يد', 'يوم'] },
  // First-class additions (Task 2) — Antura models these as letters in their
  // own right, not diacritic edge cases. Letter inventory grows to 30.
  { glyph: 'ة', name: 'تاء مربوطة', romanised: 'taa_marbuta', sound: 't', examples: ['مدرسة', 'ساعة', 'حياة'] },
  { glyph: 'ء', name: 'همزة',       romanised: 'hamza',       sound: "'", examples: ['ماء', 'شيء'] },
];

const BY_GLYPH = Object.fromEntries(LETTERS.map(l => [l.glyph, l]));

// MOE-traditional order: the alphabetic sequence as taught in schools.
// ة and ء are appended at the end — Egyptian textbooks teach them as
// supplementary letters after the canonical 28 alif-baa recitation.
const MOE_ORDER = ['ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','ه','و','ي','ة','ء'];

// Frequency-weighted order: high-utility letters first so functional words
// (أم, باب, يد, ماء, بيت, نهر…) are reachable within the first few sessions.
// ة (feminine noun marker, very frequent) is inserted mid-pack so common
// words like مدرسة / ساعة become reachable early; ء (rare raw, common via
// أ إ ؤ ئ variants we already accept) lands toward the end.
const FREQUENCY_ORDER = ['ا','ل','م','ي','ن','ة','و','ر','ت','ب','ه','ع','س','ف','ك','د','ق','ح','ج','ش','ز','خ','ص','ث','ط','ذ','ض','غ','ظ','ء'];

// Shape-family order from Antura's curriculum (vgwb/Antura, BSD-2-Clause).
// Letters that share a base shape are taught together so the learner internalises
// "this stroke + how many dots/which side." Less optimal for adult Egyptian
// learners than frequency-weighted (early word formation is limited) but
// some facilitators prefer it for the visual logic. Hamza and taa marbuta
// land in Task 2 — until then this order spans the standard 28 letters.
const SHAPE_ORDER = [
  // Stage 1: identical base shape, differ by dot count/position
  'ب','ت','ث','ن','ي',
  // Stage 2: same family
  'ج','ح','خ',
  // Stage 3: single-connection letters
  'ا','د','ذ','ر','ز','و',
  // Stage 4: seen/sad family
  'س','ش','ص','ض','ط','ظ',
  // Stage 5: feh/qaf plus hamza + taa marbuta (Antura groups them here)
  'ف','ق','ء','ة',
  // Stage 6: remainder
  'ع','غ','م','ك','ل','ه',
];

function orderFor(mode) {
  if (mode === 'moe') return MOE_ORDER;
  if (mode === 'shape') return SHAPE_ORDER;
  return FREQUENCY_ORDER;
}

function letterInfo(glyph) {
  return BY_GLYPH[glyph] || null;
}

/**
 * Next letter for a learner given their existing progress.
 * Returns null when every letter in the chosen order is mastered.
 */
function nextLetter(orderMode, knownGlyphs) {
  const order = orderFor(orderMode);
  for (const g of order) {
    if (!knownGlyphs.includes(g)) return letterInfo(g);
  }
  return null;
}

module.exports = {
  LETTERS,
  MOE_ORDER,
  FREQUENCY_ORDER,
  SHAPE_ORDER,
  orderFor,
  letterInfo,
  nextLetter,
};
