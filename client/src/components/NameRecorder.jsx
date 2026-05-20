import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, Play, RotateCcw } from 'lucide-react';
import { createRecorder, isRecordingSupported } from '../lib/recorder';

/**
 * Tap-to-record the learner's spoken name. No typing, no reading.
 * Big mic button: tap to start, tap to stop. Then play back / re-record.
 * Calls onCaptured(dataUrl) whenever a recording is captured.
 */
export default function NameRecorder({ onCaptured }) {
  const [state, setState] = useState('idle'); // idle | recording | done | unsupported
  const [dataUrl, setDataUrl] = useState(null);
  const recRef = useRef(null);

  useEffect(() => {
    if (!isRecordingSupported()) setState('unsupported');
    return () => { recRef.current?.dispose?.(); };
  }, []);

  async function startRec() {
    try {
      const rec = await createRecorder();
      recRef.current = rec;
      rec.start();
      setState('recording');
    } catch {
      setState('unsupported');
    }
  }

  async function stopRec() {
    const rec = recRef.current;
    if (!rec) return;
    const url = await rec.stop();
    rec.dispose();
    recRef.current = null;
    setDataUrl(url);
    setState('done');
    onCaptured?.(url);
  }

  function playback() {
    if (dataUrl) { try { new Audio(dataUrl).play().catch(() => {}); } catch { /* noop */ } }
  }

  function reset() {
    setDataUrl(null);
    setState('idle');
    onCaptured?.(null);
  }

  if (state === 'unsupported') {
    // Graceful path: device can't record. Let the flow continue without audio.
    return (
      <div className="text-center text-stone-500 text-sm py-4">
        التسجيل غير متاح على هذا الجهاز.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {state !== 'done' && (
        <motion.button
          type="button"
          onClick={state === 'recording' ? stopRec : startRec}
          whileTap={{ scale: 0.93 }}
          aria-label={state === 'recording' ? 'إيقاف التسجيل' : 'سجّل اسمك'}
          className={`w-28 h-28 rounded-full flex items-center justify-center shadow-lg text-white ${
            state === 'recording' ? 'bg-rose-500' : 'bg-[var(--color-bedaya-teal)]'
          }`}
        >
          {state === 'recording' ? <Square size={44} /> : <Mic size={48} />}
        </motion.button>
      )}

      {state === 'recording' && (
        <motion.div
          className="flex items-center gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-2 h-2 rounded-full bg-rose-400"
              animate={{ scaleY: [1, 2.4, 1] }}
              transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
            />
          ))}
        </motion.div>
      )}

      {state === 'done' && (
        <div className="flex items-center gap-3">
          <motion.button
            type="button"
            onClick={playback}
            whileTap={{ scale: 0.93 }}
            aria-label="استمع"
            className="w-20 h-20 rounded-full bg-[var(--color-bedaya-teal)] text-white shadow-md flex items-center justify-center"
          >
            <Play size={36} />
          </motion.button>
          <motion.button
            type="button"
            onClick={reset}
            whileTap={{ scale: 0.93 }}
            aria-label="سجّل مرة أخرى"
            className="w-16 h-16 rounded-full bg-white border-2 border-stone-200 text-stone-600 flex items-center justify-center"
          >
            <RotateCcw size={26} />
          </motion.button>
        </div>
      )}
    </div>
  );
}
