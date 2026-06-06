import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Volume2 } from 'lucide-react';
import AlifMark from '../components/AlifMark';
import ListenButton from '../components/ListenButton';
import { useLearner } from '../context/LearnerContext';
import { useGuide } from '../context/GuideContext';
import { speak, unlockAudio } from '../lib/voice';

const GREETING = {
  key: 'welcome',
  text: 'أهلاً بيك. هنا هنتعلّم نقرا ونكتب مع بعض. دوس على الزرار الكبير عشان نبدأ.',
};

export default function WelcomePage() {
  const navigate = useNavigate();
  const { learner, loading } = useLearner();
  const { guide } = useGuide();
  // Gate the page on a first-tap gesture. Browsers block audio.play() before
  // any user interaction, so auto-speak on mount falls through to robotic
  // browser TTS. The pulsing speaker icon below baits the gesture; on tap we
  // unlockAudio() and immediately speak the welcome via the proper MP3 path.
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!loading && learner) navigate('/home', { replace: true });
  }, [learner, loading, navigate]);

  function handleStart() {
    if (started) return;
    unlockAudio();
    speak(GREETING, { guide });
    setStarted(true);
  }

  function goSignup() {
    unlockAudio();
    navigate('/signup');
  }

  if (loading) return null;

  if (!started) {
    return (
      <div
        onClick={handleStart}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleStart();
          }
        }}
        aria-label="اضغط للبدء"
        className="min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center cursor-pointer select-none"
      >
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <AlifMark size={96} />
        </motion.div>
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 1.4 }}
          className="mt-14 w-32 h-32 rounded-full bg-[var(--color-bedaya-clay)] text-white shadow-xl flex items-center justify-center"
        >
          <Volume2 size={60} />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <AlifMark size={96} />
      </motion.div>

      <h1 className="font-display text-4xl mt-6 font-extrabold">بداية</h1>

      {/* The hero action: one huge, obvious, pulsing button. Voice explains it. */}
      <motion.button
        onClick={goSignup}
        whileTap={{ scale: 0.95 }}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ repeat: Infinity, duration: 1.8 }}
        aria-label="ابدأ"
        className="mt-12 w-40 h-40 rounded-full bg-[var(--color-bedaya-teal)] text-white shadow-xl flex items-center justify-center"
      >
        <ArrowLeft size={72} strokeWidth={2.5} />
      </motion.button>

      {/* Always-present "hear it again" */}
      <div className="mt-10 flex flex-col items-center gap-2">
        <ListenButton line={GREETING} size="lg" />
        <span className="text-stone-400 text-sm">استمع</span>
      </div>
    </div>
  );
}
