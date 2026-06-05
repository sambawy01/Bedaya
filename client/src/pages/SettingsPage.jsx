import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check } from 'lucide-react';
import { api } from '../lib/api';
import { useLearner } from '../context/LearnerContext';
import { useGuide } from '../context/GuideContext';

// Audience here is the literate helper, not the learner — copy is concise
// Arabic, dense layout, no voice prompts. The two settings the server now
// accepts via PUT /learners/:id are letter_order and voice_guide.

const ORDERS = [
  { key: 'frequency', label: 'حسب الاستخدام',     hint: 'الحروف الأكثر شيوعاً أولاً (افتراضي)' },
  { key: 'moe',       label: 'الترتيب الأبجدي',    hint: 'ترتيب وزارة التربية: ا ب ت ث…' },
  { key: 'shape',     label: 'حسب شكل الحرف',     hint: 'حروف ذات شكل متشابه معاً: ب ت ث ن ي' },
];

const GUIDES = [
  { key: 'umm_yasmin', label: 'أم ياسمين', emoji: '👩🏽' },
  { key: 'amm_hassan', label: 'عم حسن',     emoji: '👨🏽' },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { learner, setLearner } = useLearner();
  const { chooseGuide } = useGuide();
  const [saving, setSaving] = useState(null); // which field is in-flight

  if (!learner) {
    navigate('/', { replace: true });
    return null;
  }

  async function update(patch) {
    const field = Object.keys(patch)[0];
    setSaving(field);
    try {
      const next = await api(`/learners/${learner.id}`, { method: 'PUT', body: patch });
      setLearner(next);
      if (patch.voiceGuide) chooseGuide(patch.voiceGuide);
    } catch {
      // Surface a quiet failure — the buttons just stay on the old value.
    } finally {
      setSaving(null);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen px-6 py-8 max-w-md mx-auto">
      <header className="flex items-center justify-between mb-8">
        <button
          onClick={() => navigate('/home')}
          aria-label="رجوع"
          className="w-12 h-12 rounded-full bg-white border-2 border-stone-200 flex items-center justify-center text-stone-500"
        >
          <ArrowLeft size={22} className="rotate-180" />
        </button>
        <h1 className="font-display text-2xl font-bold">الإعدادات</h1>
        <div className="w-12" />
      </header>

      <Section title="ترتيب الحروف">
        <div className="space-y-3">
          {ORDERS.map((o) => {
            const selected = learner.letter_order === o.key;
            return (
              <motion.button
                key={o.key}
                whileTap={{ scale: 0.98 }}
                disabled={saving === 'letterOrder'}
                onClick={() => !selected && update({ letterOrder: o.key })}
                className={`w-full p-4 rounded-2xl border-2 text-right transition ${
                  selected
                    ? 'border-[var(--color-bedaya-teal)] bg-emerald-50'
                    : 'border-stone-200 bg-white'
                } disabled:opacity-60`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-display text-lg font-bold flex-1">{o.label}</span>
                  {selected && <Check size={22} className="text-[var(--color-bedaya-teal)]" />}
                </div>
                <p className="text-sm text-stone-500 mt-1">{o.hint}</p>
              </motion.button>
            );
          })}
        </div>
      </Section>

      <Section title="الصوت">
        <div className="grid grid-cols-2 gap-3">
          {GUIDES.map((g) => {
            const selected = learner.voice_guide === g.key;
            return (
              <motion.button
                key={g.key}
                whileTap={{ scale: 0.98 }}
                disabled={saving === 'voiceGuide'}
                onClick={() => !selected && update({ voiceGuide: g.key })}
                className={`p-5 rounded-2xl border-2 flex flex-col items-center gap-2 transition ${
                  selected
                    ? 'border-[var(--color-bedaya-teal)] bg-emerald-50'
                    : 'border-stone-200 bg-white'
                } disabled:opacity-60`}
              >
                <span className="text-4xl" aria-hidden>{g.emoji}</span>
                <span className="font-display text-base font-bold">{g.label}</span>
                {selected && <Check size={20} className="text-[var(--color-bedaya-teal)]" />}
              </motion.button>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-sm font-bold text-stone-500 uppercase mb-3">{title}</h2>
      {children}
    </section>
  );
}
