import { useEffect, useRef } from 'react';
import { speak, stopSpeaking } from './voice';

/**
 * Speak a line once when a screen (or step) mounts/changes.
 * Pass a string or { key, text }. `deps` retriggers it (e.g. lesson phase).
 *
 * Note: the very first auto-speak in a session may be blocked by the browser
 * until a user gesture has unlocked audio (see unlockAudio). The persistent
 * ListenButton is the fallback for that case.
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
    return () => { clearTimeout(t); stopSpeaking(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
