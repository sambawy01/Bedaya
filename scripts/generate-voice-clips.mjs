#!/usr/bin/env node
/**
 * Generate pre-baked voice clips for Bedaya's static phrases using Microsoft
 * Edge Read Aloud TTS (free, no API key). Outputs Egyptian Arabic neural
 * voices: ar-EG-SalmaNeural (Umm Yasmin) and ar-EG-ShakirNeural (Amm Hassan).
 *
 * Re-runnable. Drops files into client/public/audio/voice/<guide>/<key>.mp3.
 * Run with: node scripts/generate-voice-clips.mjs
 *
 * Note: msedge-tts is dev-only (not used at runtime); install on demand.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TMP_DIR = '/tmp/bedaya-tts-deps';

// Ensure msedge-tts is installed in an isolated dir so it doesn't leak into
// either client/ or server/ production deps.
function ensureDep() {
  if (!fs.existsSync(path.join(TMP_DIR, 'node_modules', 'msedge-tts'))) {
    console.log('Installing msedge-tts to', TMP_DIR);
    fs.mkdirSync(TMP_DIR, { recursive: true });
    execSync('npm i --silent msedge-tts', { cwd: TMP_DIR, stdio: 'inherit' });
  }
}
ensureDep();

// msedge-tts ships a single dist/index entrypoint; resolve via the installed
// package.json so this works across version bumps.
const pkgRoot = path.join(TMP_DIR, 'node_modules', 'msedge-tts');
const pkgMain = (() => {
  const pkg = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'));
  const entry = pkg.module || pkg.main || './dist/index.js';
  return path.join(pkgRoot, entry.endsWith('.js') ? entry : `${entry}.js`);
})();
const { MsEdgeTTS, OUTPUT_FORMAT } = await import(pkgMain);

const VOICES = {
  umm_yasmin: 'ar-EG-SalmaNeural',
  amm_hassan: 'ar-EG-ShakirNeural',
};

// Phrase keys map to the strings the app speaks. Values follow the same Arabic
// the existing code uses verbatim — copying drift would desync the audio from
// the rest of the UI. Keys are referenced by RECORDINGS in client/src/lib/voice.js.
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

// Voice samples — each only generated in its OWN voice (the sample IS that voice).
const SAMPLES = {
  sample_umm_yasmin: { voice: 'umm_yasmin', text: 'أنا أم ياسمين، هكون معاك في كل خطوة.' },
  sample_amm_hassan: { voice: 'amm_hassan', text: 'أنا عم حسن، هتعلّم معايا براحتك.' },
};

async function synthesize(voiceId, text, destPath) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voiceId, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = await tts.toStream(text);
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(destPath);
    audioStream.pipe(out);
    out.on('finish', resolve);
    out.on('error', reject);
    audioStream.on('error', reject);
  });
}

async function main() {
  let totalBytes = 0;
  let count = 0;

  // Dual-voice phrases.
  for (const [guideKey, voiceId] of Object.entries(VOICES)) {
    const outDir = path.join(ROOT, 'client', 'public', 'audio', 'voice', guideKey);
    fs.mkdirSync(outDir, { recursive: true });
    for (const [phraseKey, text] of Object.entries(PHRASES)) {
      const dest = path.join(outDir, `${phraseKey}.mp3`);
      await synthesize(voiceId, text, dest);
      const size = fs.statSync(dest).size;
      totalBytes += size;
      count += 1;
      console.log(`  ${guideKey}/${phraseKey}.mp3  ${size.toLocaleString()} bytes`);
    }
  }

  // Per-voice samples.
  for (const [key, { voice, text }] of Object.entries(SAMPLES)) {
    const outDir = path.join(ROOT, 'client', 'public', 'audio', 'voice', voice);
    fs.mkdirSync(outDir, { recursive: true });
    const dest = path.join(outDir, `${key}.mp3`);
    await synthesize(VOICES[voice], text, dest);
    const size = fs.statSync(dest).size;
    totalBytes += size;
    count += 1;
    console.log(`  ${voice}/${key}.mp3  ${size.toLocaleString()} bytes  (single-voice)`);
  }

  console.log(`\nDone. ${count} files, ${(totalBytes / 1024).toFixed(1)} KB total.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
