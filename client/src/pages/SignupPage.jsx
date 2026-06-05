import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, Volume2 } from 'lucide-react';
import ListenButton from '../components/ListenButton';
import NameRecorder from '../components/NameRecorder';
import { api } from '../lib/api';
import { useLearner } from '../context/LearnerContext';
import { useGuide } from '../context/GuideContext';
import { useAutoSpeak } from '../lib/useAutoSpeak';
import { speak, unlockAudio } from '../lib/voice';
import { savePendingNameAudio, promotePendingNameAudio } from '../lib/recorder';

const GUIDES = [
  { key: 'umm_yasmin', label: 'أم ياسمين', sample: 'أنا أم ياسمين، هكون معاك في كل خطوة.', emoji: '👩🏽' },
  { key: 'amm_hassan', label: 'عم حسن', sample: 'أنا عم حسن، هتعلّم معايا براحتك.', emoji: '👨🏽' },
];

const GUIDE_PROMPT = { key: 'pick_guide', text: 'اختار الصوت اللي يعجبك. دوس على الصورة عشان تسمعه.' };
const NAME_PROMPT  = { key: 'say_name',   text: 'دلوقتي قول اسمك. دوس على الزرار وقول اسمك.' };

export default function SignupPage() {
  const navigate = useNavigate();
  const { login } = useLearner();
  const { guide, chooseGuide } = useGuide();
  const [step, setStep] = useState('guide'); // guide | name
  const [picked, setPicked] = useState(null);
  const [nameAudio, setNameAudio] = useState(null);
  const [saving, setSaving] = useState(false);

  useAutoSpeak(step === 'guide' ? GUIDE_PROMPT : NAME_PROMPT, {
    guide: step === 'name' ? (picked || guide) : guide,
    deps: [step],
  });

  function pick(g) {
    unlockAudio();
    setPicked(g.key);
    chooseGuide(g.key);
    speak({ key: `sample_${g.key}`, text: g.sample }, { guide: g.key });
  }

  function toName() {
    unlockAudio();
    setStep('name');
  }

  async function finish() {
    setSaving(true);
    if (nameAudio) savePendingNameAudio(nameAudio);
    try {
      const learner = await api('/learners', {
        method: 'POST',
        body: {
          // Identity is the spoken recording (kept on-device). The server row
          // just needs a non-empty name; the UI never shows it.
          name: 'متعلّم',
          voiceGuide: picked || guide,
          letterOrder: 'frequency',
          deviceId: localStorage.getItem('bedaya_device_id') || `dev-${Date.now()}`,
        },
      });
      promotePendingNameAudio(learner.id);
      login(learner);
      navigate('/home', { replace: true });
    } catch {
      speak({ key: 'error_signup', text: 'حصل خطأ صغير. حاول تاني.' }, { guide: picked || guide });
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-sm flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => (step === 'guide' ? navigate('/') : setStep('guide'))}
            className="w-12 h-12 rounded-full bg-white border-2 border-stone-200 flex items-center justify-center text-stone-500"
            aria-label="رجوع"
          >
            <ArrowLeft size={22} className="rotate-180" />
          </button>
          <ListenButton line={step === 'guide' ? GUIDE_PROMPT : NAME_PROMPT} />
        </div>

        <AnimatePresence mode="wait">
          {step === 'guide' && (
            <motion.div key="guide" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="space-y-4">
                {GUIDES.map((g) => (
                  <button
                    key={g.key}
                    onClick={() => pick(g)}
                    className={`w-full p-5 rounded-3xl border-2 flex items-center gap-4 transition ${
                      picked === g.key
                        ? 'border-[var(--color-bedaya-teal)] bg-emerald-50'
                        : 'border-stone-200 bg-white'
                    }`}
                  >
                    <span className="text-5xl" aria-hidden>{g.emoji}</span>
                    <span className="font-display text-2xl font-bold flex-1 text-right">{g.label}</span>
                    {picked === g.key
                      ? <Check size={28} className="text-[var(--color-bedaya-teal)]" />
                      : <Volume2 size={24} className="text-stone-400" />}
                  </button>
                ))}
              </div>

              <button
                onClick={toName}
                disabled={!picked}
                aria-label="تابع"
                className="mt-10 w-full h-20 rounded-3xl bg-[var(--color-bedaya-teal)] text-white flex items-center justify-center disabled:opacity-40"
              >
                <ArrowLeft size={44} strokeWidth={2.5} />
              </button>
            </motion.div>
          )}

          {step === 'name' && (
            <motion.div key="name" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
              <div className="flex-1 flex items-center justify-center py-6">
                <NameRecorder onCaptured={setNameAudio} />
              </div>
              <button
                onClick={finish}
                disabled={saving}
                aria-label="ابدأ"
                className="w-full h-20 rounded-3xl bg-[var(--color-bedaya-teal)] text-white flex items-center justify-center disabled:opacity-50"
              >
                <ArrowLeft size={44} strokeWidth={2.5} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
