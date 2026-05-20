import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import AlifMark from '../components/AlifMark';
import { useLearner } from '../context/LearnerContext';

export default function WelcomePage() {
  const navigate = useNavigate();
  const { learner, loading } = useLearner();

  useEffect(() => {
    if (!loading && learner) navigate('/home', { replace: true });
  }, [learner, loading, navigate]);

  if (loading) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <AlifMark size={88} />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="font-display text-4xl mt-6 font-extrabold text-[var(--color-bedaya-ink)]"
      >
        بداية
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="mt-3 text-lg text-stone-600 max-w-sm font-medium"
      >
        تعلّم القراءة والكتابة في عشر دقائق يومياً.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.35 }}
        className="mt-10 w-full max-w-sm"
      >
        <button
          onClick={() => navigate('/signup')}
          className="w-full py-4 rounded-2xl bg-[var(--color-bedaya-teal)] text-white text-lg font-bold shadow-md hover:opacity-95 transition"
        >
          ابدأ الآن
        </button>
        <p className="mt-4 text-sm text-stone-500 leading-relaxed">
          مجاناً، بدون إعلانات. تتعلّم بسرعتك.
        </p>
      </motion.div>
    </div>
  );
}
