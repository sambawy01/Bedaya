import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, ArrowLeft, CheckCircle2, Home } from 'lucide-react';
import { api } from '../lib/api';
import { useLearner } from '../context/LearnerContext';
import { useGuide } from '../context/GuideContext';
import { speak, stopSpeaking, unlockAudio } from '../lib/voice';
import ListenButton from '../components/ListenButton';
import TraceCanvas from '../components/TraceCanvas';

const PHASES = ['warmup', 'phonics', 'trace', 'story', 'done'];

export default function LessonPage() {
  const navigate = useNavigate();
  const { learner, setLearner } = useLearner();
  const { guide } = useGuide();
  const [plan, setPlan] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [phase, setPhase] = useState('warmup');
  const [story, setStory] = useState(null);
  const [storyLoading, setStoryLoading] = useState(false);
  const [error, setError] = useState(null);
  const spokenPhase = useRef(null);
  // StrictMode double-invokes effects in dev; without a guard the
  // POST /lessons/start fires twice and orphans the first session row in
  // bedaya_sessions. Dedupe by learner.id — a real re-mount with a
  // different learner correctly re-runs the start path.
  const startedFor = useRef(null);

  useEffect(() => {
    if (!learner) { navigate('/', { replace: true }); return; }
    if (startedFor.current === learner.id) return;
    startedFor.current = learner.id;
    let cancelled = false;
    (async () => {
      try {
        const p = await api(`/lessons/next/${learner.id}`);
        if (cancelled) return;
        if (p.complete) { setPhase('done'); setPlan(p); return; }
        const sess = await api('/lessons/start', {
          method: 'POST',
          body: { learnerId: learner.id, letter: p.newLetter.glyph },
        });
        if (cancelled) return;
        setPlan(p);
        setSessionId(sess.id);
        // Skip warm-up when nothing's due — FSRS may legitimately return an
        // empty set on first-day-back or for a brand-new learner.
        const hasWarmup = (p.warmupScheduled && p.warmupScheduled.length > 0)
          || (p.known && p.known.length > 0);
        setPhase(hasWarmup ? 'warmup' : 'phonics');
      } catch (e) {
        if (!cancelled) setError(e.message || 'حدث خطأ');
      }
    })();
    // No stopSpeaking() on unmount — when the user finishes naturally
    // (advance('done') → finish() → navigate('/home')), we want the
    // 'برافو' celebration to keep playing across the route change. Home
    // button + error screen call stopSpeaking explicitly when they need to.
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learner]);

  const newLetter = plan?.newLetter;
  // Prefer the FSRS-selected warm-up queue; fall back to the full known set
  // when no cards are due (e.g. on a first-day-back where everything is
  // scheduled for the future, or for legacy clients pre-FSRS-backfill).
  // Items are normalized to { glyph, letterId } so the warm-up grid and the
  // phase POST share the same shape. Memoized on `plan` so `advance`'s
  // useCallback is meaningful — without this the dep changes every render.
  const warmupItems = useMemo(() => {
    if (!plan) return [];
    if (plan.warmupScheduled && plan.warmupScheduled.length > 0) {
      return plan.warmupScheduled.map((w) => ({ glyph: w.glyph, letterId: w.letterId }));
    }
    return (plan.known || []).map((g) => ({ glyph: g, letterId: null }));
  }, [plan]);

  // Build the spoken instruction for the current phase. Returns { key, text }
  // so speak() can pick the pre-recorded ElevenLabs clip (per-guide voice)
  // for every line — including the phonics intro, which has a per-letter
  // phonics_intro_<glyph> clip with the letter name baked in.
  const phaseLine = useCallback(() => {
    switch (phase) {
      case 'warmup':
        return { key: 'phase_warmup', text: 'دي الحروف اللي عرفتها. دوس على أي حرف عشان تسمعه. بعدين دوس الزرار الأخضر عشان نكمل.' };
      case 'phonics':
        return newLetter
          ? { key: `phonics_intro_${newLetter.glyph}`, text: `ده حرف جديد. اسمه ${newLetter.name}. دوس على الزرار البرتقالي عشان تسمعه.` }
          : '';
      case 'trace':
        return { key: 'phase_trace', text: 'دلوقتي اكتب الحرف بإصبعك فوق الخط.' };
      case 'story':
        // Stay silent while the AI story is loading — the visual placeholder
        // 'لحظة…' on screen already signals waiting. Speaking 'لحظة صغيرة'
        // here only created an interruption when the story arrived 1-2s
        // later and the real phase_story_* clip wanted the channel.
        if (!story) return '';
        return story.mode === 'words'
          ? { key: 'phase_story_words', text: 'دي كلمات فيها بس الحروف اللي عرفتها. دوس عليها عشان تسمعها.' }
          : story.mode === 'letters'
          ? { key: 'phase_story_letters', text: 'برافو! ده أول حرف. الكلمات هتيجي بعد حروف أكتر.' }
          : { key: 'phase_story_normal', text: 'دي قصة قصيرة. دوس عشان تسمعها.' };
      case 'done':
        return { key: 'phase_done', text: 'برافو عليك! خلّصت درس النهاردة.' };
      default:
        return '';
    }
  }, [phase, newLetter, story]);

  // Auto-speak on phase change. Stops any in-flight audio first — without
  // this, the previous phase's clip overlaps the new phase's clip for the
  // 350ms scheduling gap (and longer if the prior clip hadn't finished).
  // Single source of truth for cross-phase audio handoff; no per-screen
  // duct-tape needed.
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
    const t = setTimeout(() => { speak(line, { guide, queueAfterCurrent: true }); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, story, storyLoading]);

  const advance = useCallback((next) => {
    unlockAudio();
    if (sessionId && (phase === 'warmup' || phase === 'phonics' || phase === 'story')) {
      // Pass letterIds when leaving warm-up so the server rates the FSRS
      // cards for each reviewed letter. Phonics and story phases don't
      // carry per-letter IDs — they signal BKT mastery for the focus letter.
      const body = { sessionId, phase };
      if (phase === 'warmup') {
        const letterIds = warmupItems.map((w) => w.letterId).filter((id) => id != null);
        if (letterIds.length > 0) body.letterIds = letterIds;
      }
      api('/lessons/phase', { method: 'POST', body }).catch(() => {});
    }
    setPhase(next);
  }, [sessionId, phase, warmupItems]);

  async function loadStory() {
    if (!learner) return;
    setStoryLoading(true);
    try {
      const result = await api('/story', { method: 'POST', body: { learnerId: learner.id } });
      setStory(result);
      // No auto-read of the generated story text — it has no pre-recorded
      // clip (dynamic AI output) so it would fall through to browser TTS
      // and stomp on the just-fired phase_story_* intro from useEffect.
      // The orange Volume button below the story handles on-demand playback.
    } catch (e) {
      setError(e.message);
    } finally {
      setStoryLoading(false);
    }
  }

  async function finish() {
    if (!sessionId) { navigate('/home'); return; }
    try {
      // BKT decides mastery from the trace + phonics + story signals fed
      // during this session — no explicit masterLetter override.
      const result = await api('/lessons/complete', {
        method: 'POST', body: { sessionId },
      });
      if (result?.learner) setLearner(result.learner);
    } catch { /* best-effort */ }
    navigate('/home');
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4">
        <ListenButton line={{ key: 'error_lesson', text: 'حصل خطأ. ارجع للرئيسية.' }} size="lg" />
        <button
          onClick={() => navigate('/home')}
          className="w-16 h-16 rounded-full bg-[var(--color-bedaya-teal)] text-white flex items-center justify-center"
          aria-label="الرئيسية"
        >
          <ArrowLeft size={30} className="rotate-180" />
        </button>
      </div>
    );
  }

  if (!plan && phase !== 'done') {
    return <div className="min-h-screen flex items-center justify-center text-stone-400">لحظة…</div>;
  }

  return (
    <div className="min-h-screen px-6 py-8 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => { stopSpeaking(); navigate('/home'); }}
          aria-label="الرئيسية"
          className="w-12 h-12 rounded-full bg-white border-2 border-stone-200 flex items-center justify-center text-stone-500 shrink-0"
        >
          <Home size={22} />
        </button>
        <PhaseDots current={phase} />
        <ListenButton line={phaseLine()} />
      </div>

      <AnimatePresence mode="wait">
        {phase === 'warmup' && (
          <motion.div key="warmup" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="grid grid-cols-4 gap-3 mb-10">
              {warmupItems.map(({ glyph }) => (
                <button
                  key={glyph}
                  onClick={() => { unlockAudio(); speak(glyph, { guide }); }}
                  className="aspect-square rounded-2xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center font-script text-3xl font-bold text-[var(--color-bedaya-teal)]"
                  aria-label={`الحرف ${glyph}`}
                >
                  {glyph}
                </button>
              ))}
            </div>
            <button
              onClick={() => advance('phonics')}
              aria-label="تابع"
              className="w-full h-20 rounded-3xl bg-[var(--color-bedaya-teal)] text-white flex items-center justify-center"
            >
              <ArrowLeft size={44} strokeWidth={2.5} />
            </button>
          </motion.div>
        )}

        {phase === 'phonics' && newLetter && (
          <motion.div key="phonics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center">
            <div className="mx-auto w-52 h-52 rounded-3xl bg-white border-2 border-stone-200 flex items-center justify-center font-script text-9xl font-bold mb-6">
              {newLetter.glyph}
            </div>
            <button
              onClick={() => { unlockAudio(); speak(newLetter.glyph, { guide }); }}
              aria-label="اسمع الحرف"
              className="mx-auto w-20 h-20 rounded-full bg-[var(--color-bedaya-clay)] text-white shadow-md flex items-center justify-center"
            >
              <Volume2 size={36} />
            </button>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {newLetter.examples.map((w) => (
                <button
                  key={w}
                  onClick={() => { unlockAudio(); speak(w, { guide }); }}
                  className="px-4 py-3 rounded-xl bg-white border border-stone-200 font-script text-2xl"
                >
                  {w}
                </button>
              ))}
            </div>
            <button
              onClick={() => advance('trace')}
              aria-label="اكتب الحرف"
              className="w-full mt-10 h-20 rounded-3xl bg-[var(--color-bedaya-teal)] text-white flex items-center justify-center"
            >
              <ArrowLeft size={44} strokeWidth={2.5} />
            </button>
          </motion.div>
        )}

        {phase === 'trace' && newLetter && (
          <motion.div key="trace" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <TraceCanvas
              letter={newLetter.glyph}
              onComplete={() => {
                if (learner) {
                  api('/trace', { method: 'POST', body: { learnerId: learner.id, letter: newLetter.glyph } }).catch(() => {});
                }
                setPhase('story');
                loadStory();
              }}
            />
          </motion.div>
        )}

        {phase === 'story' && (
          <motion.div key="story" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center">
            {storyLoading || !story ? (
              <div className="py-12 text-stone-400">لحظة…</div>
            ) : (
              <>
                <div dir="rtl" className="font-script text-4xl leading-loose bg-white border-2 border-stone-200 rounded-3xl p-6 min-h-32 flex items-center justify-center">
                  {story.story}
                </div>
                {/* For modes 'words' and 'letters' the story is a ' · '-joined
                    list of pre-baked words or single letters — split and queue
                    each so the existing word_<w>/letter_<g> recordings play
                    in turn instead of falling through to browser TTS on the
                    joined string. Mode 'normal' (AI-generated full sentence)
                    is still browser TTS until we add a server-side ElevenLabs
                    proxy. */}
                <button
                  onClick={() => {
                    unlockAudio();
                    const parts = (story.story || '')
                      .split(' · ')
                      .map((s) => s.trim())
                      .filter(Boolean);
                    if (parts.length <= 1) {
                      speak(story.story, { guide });
                    } else {
                      parts.forEach((p, i) => speak(p, { guide, queueAfterCurrent: i > 0 }));
                    }
                  }}
                  aria-label="اسمع"
                  className="mx-auto mt-5 w-20 h-20 rounded-full bg-[var(--color-bedaya-clay)] text-white shadow-md flex items-center justify-center"
                >
                  <Volume2 size={36} />
                </button>
                <button
                  onClick={() => { advance('done'); finish(); }}
                  aria-label="خلصت"
                  className="w-full mt-8 h-20 rounded-3xl bg-[var(--color-bedaya-teal)] text-white flex items-center justify-center"
                >
                  <CheckCircle2 size={44} />
                </button>
              </>
            )}
          </motion.div>
        )}

        {phase === 'done' && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16">
            <CheckCircle2 size={88} className="mx-auto text-[var(--color-bedaya-success)] mb-5" />
            <button
              onClick={() => navigate('/home')}
              aria-label="الرئيسية"
              className="mx-auto w-24 h-24 rounded-full bg-[var(--color-bedaya-teal)] text-white shadow-lg flex items-center justify-center"
            >
              <ArrowLeft size={48} className="rotate-180" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PhaseDots({ current }) {
  const idx = PHASES.indexOf(current);
  return (
    <div className="flex gap-2">
      {PHASES.slice(0, -1).map((p, i) => (
        <div
          key={p}
          className={`h-1.5 rounded-full transition-all ${
            i < idx ? 'w-6 bg-[var(--color-bedaya-teal)]'
            : i === idx ? 'w-10 bg-[var(--color-bedaya-teal)]'
            : 'w-6 bg-stone-200'
          }`}
        />
      ))}
    </div>
  );
}
