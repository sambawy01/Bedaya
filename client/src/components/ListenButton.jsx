import { motion } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import { speak, unlockAudio } from '../lib/voice';
import { useGuide } from '../context/GuideContext';

/**
 * Big, always-present "listen again" button. For a learner who can't read,
 * this is the lifeline on every screen: tap it to hear the instruction again.
 * Also unlocks audio on first use so subsequent auto-speak works.
 *
 * `line` is a string or { key, text }.
 */
export default function ListenButton({ line, size = 'md', className = '' }) {
  const { guide } = useGuide();
  const dims = size === 'lg' ? 'w-20 h-20' : 'w-14 h-14';
  const icon = size === 'lg' ? 34 : 24;

  function play() {
    unlockAudio();
    speak(line, { guide });
  }

  return (
    <motion.button
      type="button"
      onClick={play}
      whileTap={{ scale: 0.92 }}
      aria-label="استمع مرة أخرى"
      className={`${dims} rounded-full bg-[var(--color-bedaya-clay)] text-white shadow-md flex items-center justify-center ${className}`}
    >
      <Volume2 size={icon} />
    </motion.button>
  );
}
