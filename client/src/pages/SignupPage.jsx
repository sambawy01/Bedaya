import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowLeft, UserCircle2 } from 'lucide-react';
import AlifMark from '../components/AlifMark';
import { api } from '../lib/api';
import { useLearner } from '../context/LearnerContext';

const GUIDES = [
  { key: 'umm_yasmin', label: 'أم ياسمين', subtitle: 'صوت نسائي — من الدلتا' },
  { key: 'amm_hassan', label: 'عم حسن',    subtitle: 'صوت رجالي — من أسوان' },
];

export default function SignupPage() {
  const navigate = useNavigate();
  const { login } = useLearner();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [voiceGuide, setVoiceGuide] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function back() {
    if (step === 0) navigate('/');
    else setStep(s => s - 1);
  }

  async function finish() {
    if (!name.trim() || !voiceGuide) return;
    setSaving(true);
    setError(null);
    try {
      const learner = await api('/learners', {
        method: 'POST',
        body: {
          name: name.trim(),
          voiceGuide,
          letterOrder: 'frequency',
          deviceId: localStorage.getItem('bedaya_device_id') || `dev-${Date.now()}`,
        },
      });
      login(learner);
      navigate('/home', { replace: true });
    } catch (e) {
      setError(e.message || 'حدث خطأ، حاول مرة أخرى');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-sm">
        <button
          onClick={back}
          className="text-stone-500 hover:text-stone-800 flex items-center gap-1 font-medium"
          aria-label="رجوع"
        >
          <ArrowRight size={18} />
          رجوع
        </button>

        <div className="mt-6 mb-8 flex items-center justify-center">
          <AlifMark size={56} />
        </div>

        {step === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            key="step0"
          >
            <h2 className="font-display text-2xl font-bold text-center">ما اسمك؟</h2>
            <p className="text-stone-500 text-center mt-1 text-sm">
              نحتاج اسمك فقط. بدون إيميل، بدون رقم.
            </p>
            <div className="mt-6 relative">
              <UserCircle2
                size={20}
                className="absolute top-1/2 -translate-y-1/2 right-3 text-stone-400"
              />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اكتب اسمك"
                className="w-full text-lg py-4 pr-10 pl-4 rounded-2xl border-2 border-stone-200 focus:border-[var(--color-bedaya-teal)] outline-none bg-white"
                autoFocus
                dir="rtl"
              />
            </div>
            <button
              onClick={() => name.trim() && setStep(1)}
              disabled={!name.trim()}
              className="w-full mt-6 py-4 rounded-2xl bg-[var(--color-bedaya-teal)] text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              التالي
              <ArrowLeft size={18} />
            </button>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            key="step1"
          >
            <h2 className="font-display text-2xl font-bold text-center">من سيرافقك؟</h2>
            <p className="text-stone-500 text-center mt-1 text-sm">اختر الصوت الذي يناسبك.</p>
            <div className="mt-6 space-y-3">
              {GUIDES.map((g) => (
                <button
                  key={g.key}
                  onClick={() => setVoiceGuide(g.key)}
                  className={`w-full text-right p-4 rounded-2xl border-2 transition ${
                    voiceGuide === g.key
                      ? 'border-[var(--color-bedaya-teal)] bg-emerald-50'
                      : 'border-stone-200 bg-white hover:border-stone-300'
                  }`}
                >
                  <div className="font-display font-bold text-lg">{g.label}</div>
                  <div className="text-sm text-stone-500 mt-0.5">{g.subtitle}</div>
                </button>
              ))}
            </div>
            <button
              onClick={finish}
              disabled={!voiceGuide || saving}
              className="w-full mt-6 py-4 rounded-2xl bg-[var(--color-bedaya-teal)] text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'لحظة…' : 'ابدأ الدرس الأول'}
            </button>
            {error && <p className="text-rose-600 text-sm text-center mt-3">{error}</p>}
          </motion.div>
        )}
      </div>
    </div>
  );
}
