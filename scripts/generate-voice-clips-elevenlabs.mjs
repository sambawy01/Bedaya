#!/usr/bin/env node
/**
 * Generate pre-baked voice clips for Bedaya's static phrases using ElevenLabs
 * (eleven_multilingual_v2). Produces noticeably better Egyptian Arabic
 * pronunciation than Microsoft Edge TTS, particularly for ECA colloquial
 * words that Edge mangled with MSA inflection.
 *
 * Required env vars:
 *   ELEVENLABS_API_KEY           — from https://elevenlabs.io/app/settings/api-keys
 *   ELEVENLABS_VOICE_UMM_YASMIN  — voice ID for the female guide
 *   ELEVENLABS_VOICE_AMM_HASSAN  — voice ID for the male guide
 *
 * Re-runnable. Drops files into client/public/audio/voice/<guide>/<key>.mp3.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const API_KEY = process.env.ELEVENLABS_API_KEY;
const UMM_YASMIN_VOICE = process.env.ELEVENLABS_VOICE_UMM_YASMIN;
const AMM_HASSAN_VOICE = process.env.ELEVENLABS_VOICE_AMM_HASSAN;

if (!API_KEY) { console.error('ELEVENLABS_API_KEY not set'); process.exit(1); }
if (!UMM_YASMIN_VOICE) { console.error('ELEVENLABS_VOICE_UMM_YASMIN not set'); process.exit(1); }
if (!AMM_HASSAN_VOICE) { console.error('ELEVENLABS_VOICE_AMM_HASSAN not set'); process.exit(1); }

const VOICES = {
  umm_yasmin: UMM_YASMIN_VOICE,
  amm_hassan: AMM_HASSAN_VOICE,
};

// Plain ECA — no tashkeel. ElevenLabs handles colloquial spelling better
// without explicit harakat (which can pull it back toward MSA inflection).
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
};

const SAMPLES = {
  sample_umm_yasmin: { voice: 'umm_yasmin', text: 'أنا أم ياسمين، هكون معاك في كل خطوة.' },
  sample_amm_hassan: { voice: 'amm_hassan', text: 'أنا عم حسن، هتعلّم معايا براحتك.' },
};

// Per-letter phonics intro — the line that auto-plays when the lesson hits the
// phonics phase. Keyed by glyph so phaseLine() can look up phonics_intro_<glyph>
// in RECORDINGS. Letter name + glyph come from the seed in services/letters.js
// (kept in sync manually; the script fails loudly if a glyph is missing below).
const LETTER_NAMES = {
  'ا': 'ألف',  'ب': 'باء',  'ت': 'تاء',  'ث': 'ثاء',
  'ج': 'جيم',  'ح': 'حاء',  'خ': 'خاء',  'د': 'دال',
  'ذ': 'ذال',  'ر': 'راء',  'ز': 'زاي',  'س': 'سين',
  'ش': 'شين',  'ص': 'صاد',  'ض': 'ضاد',  'ط': 'طاء',
  'ظ': 'ظاء',  'ع': 'عين',  'غ': 'غين',  'ف': 'فاء',
  'ق': 'قاف',  'ك': 'كاف',  'ل': 'لام',  'م': 'ميم',
  'ن': 'نون',  'ه': 'هاء',  'و': 'واو',  'ي': 'ياء',
  'ة': 'تاء مربوطة',
  'ء': 'همزة',
};
const PHONICS_INTROS = Object.fromEntries(
  Object.entries(LETTER_NAMES).map(([glyph, name]) => [
    `phonics_intro_${glyph}`,
    `ده حرف جديد. اسمه ${name}. دوس على الزرار البرتقالي عشان تسمعه.`,
  ])
);

// Per-letter name as a standalone clip — replaces the Antura MSA wavs on
// the orange Volume button and the warm-up letter tiles. Both guides get a
// recording so the on-tap pronunciation matches the active voice.
const LETTER_CLIPS = Object.fromEntries(
  Object.entries(LETTER_NAMES).map(([glyph, name]) => [`letter_${glyph}`, name])
);

const MODEL_ID = 'eleven_multilingual_v2';
const VOICE_SETTINGS = {
  stability: 0.6,
  similarity_boost: 0.75,
  style: 0.2,
  use_speaker_boost: true,
};

async function synthesize(voiceId, text, destPath) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({ text, model_id: MODEL_ID, voice_settings: VOICE_SETTINGS }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${body.slice(0, 300)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(destPath, buf);
  return buf.length;
}

async function main() {
  let totalBytes = 0;
  let count = 0;

  for (const [guideKey, voiceId] of Object.entries(VOICES)) {
    const outDir = path.join(ROOT, 'client', 'public', 'audio', 'voice', guideKey);
    fs.mkdirSync(outDir, { recursive: true });
    const all = { ...PHRASES, ...PHONICS_INTROS, ...LETTER_CLIPS };
    for (const [phraseKey, text] of Object.entries(all)) {
      const dest = path.join(outDir, `${phraseKey}.mp3`);
      const bytes = await synthesize(voiceId, text, dest);
      totalBytes += bytes; count += 1;
      console.log(`  ${guideKey}/${phraseKey}.mp3  ${bytes.toLocaleString()} bytes`);
    }
  }

  for (const [key, { voice, text }] of Object.entries(SAMPLES)) {
    const outDir = path.join(ROOT, 'client', 'public', 'audio', 'voice', voice);
    fs.mkdirSync(outDir, { recursive: true });
    const dest = path.join(outDir, `${key}.mp3`);
    const bytes = await synthesize(VOICES[voice], text, dest);
    totalBytes += bytes; count += 1;
    console.log(`  ${voice}/${key}.mp3  ${bytes.toLocaleString()} bytes  (single-voice)`);
  }

  console.log(`\nDone. ${count} files, ${(totalBytes / 1024).toFixed(1)} KB total.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
