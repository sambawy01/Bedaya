/**
 * Tiny MediaRecorder wrapper for capturing a few seconds of spoken name.
 *
 * Privacy: the audio is returned as a base64 data URL and stored only in
 * localStorage on this device. It is NEVER sent to the server or transcribed.
 */

export function isRecordingSupported() {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== 'undefined' &&
    'MediaRecorder' in window
  );
}

export async function createRecorder() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const chunks = [];
  const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);

  rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  return {
    start() {
      chunks.length = 0;
      rec.start();
    },
    stop() {
      return new Promise((resolve) => {
        rec.onstop = () => {
          const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result); // data URL
          reader.readAsDataURL(blob);
        };
        rec.stop();
      });
    },
    dispose() {
      stream.getTracks().forEach((t) => t.stop());
    },
    get state() { return rec.state; },
  };
}

const NAME_KEY = (learnerId) => `bedaya_name_audio_${learnerId}`;

export function saveNameAudio(learnerId, dataUrl) {
  try { localStorage.setItem(NAME_KEY(learnerId), dataUrl); } catch { /* quota */ }
}

export function loadNameAudio(learnerId) {
  try { return localStorage.getItem(NAME_KEY(learnerId)); } catch { return null; }
}

// During onboarding the learner doesn't have an id yet; stash under 'pending'
// then promote once the server returns the learner id.
export function savePendingNameAudio(dataUrl) {
  try { localStorage.setItem('bedaya_name_audio_pending', dataUrl); } catch { /* quota */ }
}
export function promotePendingNameAudio(learnerId) {
  try {
    const pending = localStorage.getItem('bedaya_name_audio_pending');
    if (pending) {
      localStorage.setItem(NAME_KEY(learnerId), pending);
      localStorage.removeItem('bedaya_name_audio_pending');
    }
  } catch { /* noop */ }
}

export function playNameAudio(learnerId) {
  const url = loadNameAudio(learnerId);
  if (!url) return false;
  try { new Audio(url).play().catch(() => {}); return true; } catch { return false; }
}
