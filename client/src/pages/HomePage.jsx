import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, BookOpen, CheckCircle2 } from 'lucide-react';
import AlifMark from '../components/AlifMark';
import { api } from '../lib/api';
import { useLearner } from '../context/LearnerContext';

export default function HomePage() {
  const navigate = useNavigate();
  const { learner, loading, logout } = useLearner();
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

  if (loading || !learner) return null;

  return (
    <div className="min-h-screen px-6 py-8 max-w-md mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <AlifMark size={40} />
          <div>
            <div className="font-display font-bold text-lg">أهلاً {learner.name}</div>
            <div className="text-xs text-stone-500">{learner.letters_known} حرف</div>
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate('/', { replace: true }); }}
          className="text-stone-400 hover:text-stone-700"
          aria-label="خروج"
        >
          <LogOut size={18} />
        </button>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl border-2 border-stone-100 shadow-sm p-6 mb-5"
      >
        <div className="text-xs uppercase tracking-wide font-bold text-[var(--color-bedaya-teal)] mb-2">
          درس اليوم
        </div>
        {loadingPlan ? (
          <p className="text-stone-400">لحظة…</p>
        ) : plan?.complete ? (
          <div className="text-center py-6">
            <CheckCircle2 size={36} className="mx-auto text-[var(--color-bedaya-success)] mb-2" />
            <p className="font-display text-xl font-bold">أنهيت كل الحروف</p>
            <p className="text-stone-500 text-sm mt-1">سنرسل لك تدريبات جديدة قريباً.</p>
          </div>
        ) : plan?.newLetter ? (
          <>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-[var(--color-bedaya-paper)] border-2 border-stone-200 flex items-center justify-center font-script text-5xl font-bold">
                {plan.newLetter.glyph}
              </div>
              <div>
                <div className="font-display text-xl font-bold">
                  {plan.isFirstLesson ? 'أول حرف' : `حرف ${plan.newLetter.name}`}
                </div>
                <div className="text-stone-500 text-sm mt-0.5">
                  {plan.warmup.length > 0
                    ? `${plan.warmup.length} حرف معروف + ١ جديد`
                    : 'ابدأ من هنا'}
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('/lesson')}
              className="w-full mt-5 py-4 rounded-2xl bg-[var(--color-bedaya-teal)] text-white font-bold text-lg flex items-center justify-center gap-2"
            >
              <BookOpen size={18} />
              ابدأ الدرس (١٠ دقائق)
            </button>
          </>
        ) : (
          <p className="text-stone-500">حدث خطأ في تحميل الدرس.</p>
        )}
      </motion.div>

      {plan?.warmup?.length > 0 && (
        <div className="bg-white rounded-3xl border-2 border-stone-100 p-5">
          <div className="text-xs uppercase tracking-wide font-bold text-stone-500 mb-3">
            الحروف التي تعرفها
          </div>
          <div className="flex flex-wrap gap-2">
            {plan.warmup.map((g) => (
              <div
                key={g}
                className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center font-script text-2xl font-bold text-[var(--color-bedaya-teal)]"
              >
                {g}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
