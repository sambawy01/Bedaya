import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, ArrowLeft, CheckCircle2, Volume2, Settings } from 'lucide-react';
import AlifMark from '../components/AlifMark';
import ListenButton from '../components/ListenButton';
import { api } from '../lib/api';
import { useLearner } from '../context/LearnerContext';
import { useGuide } from '../context/GuideContext';
import { useAutoSpeak } from '../lib/useAutoSpeak';
import { speak, unlockAudio } from '../lib/voice';
import { playNameAudio } from '../lib/recorder';

export default function HomePage() {
  const navigate = useNavigate();
  const { learner, loading, logout } = useLearner();
  const { guide } = useGuide();
  const [plan, setPlan] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(true);

  useEffect(() => {
    if (!loading && !learner) navigate('/', { replace: true });
  }, [loading, learner, navigate]);

  useEffect(() => {
    if (!learner) return;
    api(`/lessons/next/${learner.id}`)
      .then(setPlan)
      .catch(() => setPlan(null))
      .finally(() => setLoadingPlan(false));
  }, [learner]);

  // The home strip is "letters you've studied" — show the full known set, not
  // the FSRS-due subset (which is capped at 5 and used by the LessonPage
  // warm-up phase). The server already excludes the current focus letter from
  // plan.known so it doesn't get double-billed as both new and known.
  const warmupGlyphs = useMemo(() => plan?.known || [], [plan]);

  // Greet by playing the learner's own recorded name, then the lesson prompt.
  const prompt = plan?.complete
    ? { key: 'home_done', text: 'برافو عليك. خلّصت كل الحروف.' }
    : { key: 'home_lesson', text: 'درس النهاردة جاهز. دوس على الزرار الكبير عشان نبدأ.' };

  useAutoSpeak(prompt, { guide, deps: [plan?.complete, loadingPlan] });

  function startLesson() {
    unlockAudio();
    navigate('/lesson');
  }

  function greet() {
    unlockAudio();
    const played = learner && playNameAudio(learner.id);
    setTimeout(() => speak(prompt, { guide }), played ? 1400 : 0);
  }

  if (loading || !learner) return null;

  return (
    <div className="min-h-screen px-6 py-8 max-w-md mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <AlifMark size={40} />
          {/* Greeting plays the learner's own recorded name — no text identity. */}
          <button
            onClick={greet}
            className="flex items-center gap-2 text-stone-600"
            aria-label="استمع للترحيب"
          >
            <Volume2 size={20} className="text-[var(--color-bedaya-clay)]" />
            <span className="font-display font-bold text-base">أهلاً بيك</span>
          </button>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/settings')}
            className="text-stone-400 hover:text-stone-700"
            aria-label="الإعدادات"
          >
            <Settings size={20} />
          </button>
          <button
            onClick={() => { logout(); navigate('/', { replace: true }); }}
            className="text-stone-400 hover:text-stone-700"
            aria-label="خروج"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl border-2 border-stone-100 shadow-sm p-6 mb-5"
      >
        {loadingPlan ? (
          <p className="text-stone-400 text-center py-6">لحظة…</p>
        ) : plan?.complete ? (
          <div className="text-center py-6">
            <CheckCircle2 size={48} className="mx-auto text-[var(--color-bedaya-success)] mb-3" />
            <p className="font-display text-xl font-bold">برافو! خلّصت كل الحروف</p>
            <div className="mt-4 flex justify-center">
              <ListenButton line={prompt} />
            </div>
          </div>
        ) : plan?.newLetter ? (
          <div className="text-center">
            {/* Big letter the lesson is about — visual anchor, not text to read. */}
            <div className="mx-auto w-28 h-28 rounded-3xl bg-[var(--color-bedaya-paper)] border-2 border-stone-200 flex items-center justify-center font-script text-7xl font-bold mb-4">
              {plan.newLetter.glyph}
            </div>
            {/* The one big action. Voice explains it; arrow + letter carry meaning. */}
            <motion.button
              onClick={startLesson}
              whileTap={{ scale: 0.96 }}
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ repeat: Infinity, duration: 1.8 }}
              aria-label="ابدأ الدرس"
              className="mx-auto w-28 h-28 rounded-full bg-[var(--color-bedaya-teal)] text-white shadow-lg flex items-center justify-center"
            >
              <ArrowLeft size={56} strokeWidth={2.5} />
            </motion.button>
            <div className="mt-5 flex justify-center">
              <ListenButton line={prompt} />
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-stone-500">لحظة…</p>
          </div>
        )}
      </motion.div>

      {warmupGlyphs.length > 0 && (
        <div className="bg-white rounded-3xl border-2 border-stone-100 p-5">
          <div className="flex flex-wrap gap-2 justify-center">
            {warmupGlyphs.map((g) => (
              <button
                key={g}
                onClick={() => { unlockAudio(); speak(g, { guide }); }}
                className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center font-script text-2xl font-bold text-[var(--color-bedaya-teal)]"
                aria-label={`الحرف ${g}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
