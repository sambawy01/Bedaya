import { useEffect, useRef } from 'react';
import { speak } from './voice';

/**
 * Speak a line once when a screen (or step) mounts/changes.
 * Pass a string or { key, text }. `deps` retriggers it (e.g. lesson phase).
 *
 * Note: the very first auto-speak in a session may be blocked by the browser
 * until a user gesture has unlocked audio (see unlockAudio). The persistent
 * ListenButton is the fallback for that case.
 *
 * Cleanup ONLY clears the pending timeout — it MUST NOT call stopSpeaking().
 *
 * Why: cleanup runs whenever deps change (not only on unmount). HomePage's
 * deps include `loadingPlan`, which flips true→false when the lessons API
 * resolves a few hundred ms after mount. If cleanup stopped audio, every
 * post-lesson 'برافو' would get cut the instant /lessons/next returned —
 * exactly the bug the user reported ("برافو عليك بتتقطع ب درس النهارده").
 *
 * The `lastSpoken` fingerprint already prevents double-speaking on benign
 * re-renders. And `queueAfterCurrent: true` ensures the new prompt politely
 * waits behind any clip still playing instead of clobbering it.
 *
 * If you ever need to force-stop audio (e.g. Home button), call stopSpeaking
 * EXPLICITLY at the callsite — never bake it into a generic lifecycle hook.
 */
export function useAutoSpeak(line, { guide = 'umm_yasmin', delay = 350, deps = [] } = {}) {
  const lastSpoken = useRef(null);
  useEffect(() => {
    if (!line) return;
    const fingerprint = typeof line === 'object' ? line.key || line.text : line;
    if (lastSpoken.current === fingerprint) return;
    lastSpoken.current = fingerprint;
    // queueAfterCurrent so an inbound page's prompt waits its turn behind any
    // clip still playing from the page we navigated away from — most visibly
    // the post-lesson 'برافو' celebration that HomePage used to clobber.
    const t = setTimeout(() => speak(line, { guide, queueAfterCurrent: true }), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
