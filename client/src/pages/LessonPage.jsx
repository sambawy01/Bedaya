import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import { useLearner } from '../context/LearnerContext';
import { speak, stopSpeaking } from '../lib/voice';
import TraceCanvas from '../components/TraceCanvas';

const PHASES = ['warmup', 'phonics', 'trace', 'story', 'done'];

export default function LessonPage() {
  const navigate = useNavigate();
  const { learner, setLearner } = useLearner();
  const [plan, setPlan] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [phase, setPhase] = useState('warmup');
  const [story, setStory] = useState(null);
  const [storyLoading, setStoryLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!learner) { navigate('/', { replace: true }); return; }
    let cancelled = false;
    (async () => {
      try {
        const p = await api(`/lessons/next/${learner.id}`);
        if (cancelled) return;
        if (p.complete) {
          setPhase('done');
          setPlan(p);
          return;
        }
        const sess = await api('/lessons/start', {
          method: 'POST',
          body: { learnerId: learner.id, letter: p.newLetter.glyph },
        });
        if (cancelled) return;
        setPlan(p);
        setSessionId(sess.id);
        // If learner has no warmup yet, skip straight to phonics.
        setPhase(p.warmup.length === 0 ? 'phonics' : 'warmup');
      } catch (e) {
        if (!cancelled) setError(e.message || 'حدث خطأ');
      }
    })();
    return () => { cancelled = true; stopSpeaking(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learner]);

  const advance = useCallback(async (next) => {
    if (sessionId && (phase === 'warmup' || phase === 'phonics' || phase === 'story')) {
      api('/lessons/phase', {
        method: 'POST',
        body: { sessionId, phase: phase === 'trace' ? 'phonics' : phase },
      }).catch(() => {});
    }
    setPhase(next);
  }, [sessionId, phase]);

  async function loadStory() {
    if (!learner) return;
    setStoryLoading(true);
    try {
      const result = await api('/story', {
        method: 'POST',
        body: { learnerId: learner.id },
      });
      setStory(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setStoryLoading(false);
    }
  }

  async function finish() {
    if (!sessionId) { navigate('/home'); return; }
    try {
      const result = await api('/lessons/complete', {
        method: 'POST',
        body: { sessionId, masterLetter: true },
      });
      if (result?.learner) setLearner(result.learner);
    } catch {/* best-effort */}
    navigate('/home');
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <p className="text-rose-600 font-bold">{error}</p>
        <button onClick={() => navigate('/home')} className="mt-4 text-stone-600 underline">
          العودة للرئيسية
        </button>
      </div>
    );
  }

  if (!plan && phase !== 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-stone-400">لحظة…</p>
      </div>
    );
  }

  const newLetter = plan?.newLetter;

  return (
    <div className="min-h-screen px-6 py-8 max-w-md mx-auto">
      <PhaseDots current={phase} />

      <AnimatePresence mode="wait">
        {phase === 'warmup' && (
          <motion.div
            key="warmup"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <h2 className="font-display text-2xl font-bold text-center mb-2">حروف عرفتها</h2>
            <p className="text-stone-500 text-center text-sm mb-6">
              راجعها قبل ما نتعلّم حرف جديد.
            </p>
            <div className="grid grid-cols-4 gap-3 mb-8">
              {plan.warmup.map((g) => (
                <button
                  key={g}
                  onClick={() => speak(g, { guide: learner?.voice_guide })}
                  className="aspect-square rounded-2xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center font-script text-3xl font-bold text-[var(--color-bedaya-teal)]"
                >
                  {g}
                </button>
              ))}
            </div>
            <button
              onClick={() => advance('phonics')}
              className="w-full py-4 rounded-2xl bg-[var(--color-bedaya-teal)] text-white font-bold text-lg"
            >
              تابع للحرف الجديد
            </button>
          </motion.div>
        )}

        {phase === 'phonics' && newLetter && (
          <motion.div
            key="phonics"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            <p className="text-sm text-[var(--color-bedaya-teal)] font-bold uppercase tracking-wide mb-2">
              الحرف الجديد
            </p>
            <p className="font-display text-xl font-bold mb-6">{newLetter.name}</p>
            <div className="mx-auto w-48 h-48 rounded-3xl bg-white border-2 border-stone-200 flex items-center justify-center font-script text-9xl font-bold text-[var(--color-bedaya-ink)]">
              {newLetter.glyph}
            </div>
            <button
              onClick={() => speak(newLetter.glyph, { guide: learner?.voice_guide })}
              className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 font-bold"
            >
              <Volume2 size={18} />
              اسمع الحرف
            </button>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {newLetter.examples.map((w) => (
                <button
                  key={w}
                  onClick={() => speak(w, { guide: learner?.voice_guide })}
                  className="px-3 py-2 rounded-xl bg-white border border-stone-200 font-script text-lg"
                >
                  {w}
                </button>
              ))}
            </div>
            <button
              onClick={() => advance('trace')}
              className="w-full mt-8 py-4 rounded-2xl bg-[var(--color-bedaya-teal)] text-white font-bold text-lg flex items-center justify-center gap-2"
            >
              اكتب الحرف
              <ArrowRight size={18} className="rotate-180" />
            </button>
          </motion.div>
        )}

        {phase === 'trace' && newLetter && (
          <motion.div
            key="trace"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <h2 className="font-display text-2xl font-bold text-center mb-1">اكتب {newLetter.name}</h2>
            <TraceCanvas
              letter={newLetter.glyph}
              onComplete={async () => {
                if (learner) {
                  api('/trace', {
                    method: 'POST',
                    body: { learnerId: learner.id, letter: newLetter.glyph },
                  }).catch(() => {});
                }
                advance('story');
                loadStory();
              }}
            />
          </motion.div>
        )}

        {phase === 'story' && (
          <motion.div
            key="story"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            <p className="text-sm text-[var(--color-bedaya-teal)] font-bold uppercase tracking-wide mb-2">
              {story?.mode === 'words' ? 'اقرأ هذه الكلمات'
                : story?.mode === 'letters' ? 'الحرف الذي تعلّمته'
                : 'القصة'}
            </p>
            <p className="text-stone-500 text-sm mb-6">
              {story?.mode === 'words'
                ? 'كل كلمة فيها فقط الحروف اللي عرفتها.'
                : story?.mode === 'letters'
                ? 'أحسنت! هذا أول حرف. الكلمات تبدأ بعد حروف أكثر.'
                : 'قصة قصيرة من الحروف اللي عرفتها.'}
            </p>
            {storyLoading || !story ? (
              <div className="py-12 text-stone-400">لحظة…</div>
            ) : (
              <>
                <div
                  dir="rtl"
                  className="font-script text-3xl leading-loose bg-white border-2 border-stone-200 rounded-3xl p-6 min-h-32"
                >
                  {story.story}
                </div>
                <button
                  onClick={() => speak(story.story, { guide: learner?.voice_guide })}
                  className="mt-4 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-stone-100 font-bold"
                >
                  <Volume2 size={18} />
                  اسمع القصة
                </button>
                <button
                  onClick={() => { advance('done'); finish(); }}
                  className="w-full mt-6 py-4 rounded-2xl bg-[var(--color-bedaya-teal)] text-white font-bold text-lg"
                >
                  أنهيت الدرس
                </button>
              </>
            )}
          </motion.div>
        )}

        {phase === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <CheckCircle2 size={72} className="mx-auto text-[var(--color-bedaya-success)] mb-4" />
            <h2 className="font-display text-2xl font-bold">أحسنت</h2>
            <p className="text-stone-500 mt-2">انتهيت من درس اليوم.</p>
            <button
              onClick={() => navigate('/home')}
              className="mt-6 py-3 px-6 rounded-2xl bg-[var(--color-bedaya-teal)] text-white font-bold"
            >
              العودة للرئيسية
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
    <div className="flex justify-center gap-2 mb-8">
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
