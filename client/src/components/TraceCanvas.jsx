import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Check } from 'lucide-react';

/**
 * Handwriting trace canvas. Adult-respecting: large surface, no scoring,
 * no "wrong" feedback. The learner traces N times and advances.
 *
 * Privacy: nothing leaves the canvas. We don't save strokes anywhere.
 */
export default function TraceCanvas({ letter, onComplete, targetCount = 3 }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const drawingRef = useRef(false);
  const [strokes, setStrokes] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#0F766E';
    ctxRef.current = ctx;
    drawGhost();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letter]);

  function drawGhost() {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    // Subtle baseline
    ctx.strokeStyle = '#E7E2D8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.75);
    ctx.lineTo(w, h * 0.75);
    ctx.stroke();
    // Ghost letter
    ctx.fillStyle = '#E7E2D8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${h * 0.7}px "Noto Naskh Arabic", serif`;
    ctx.fillText(letter, w / 2, h / 2);
    // Reset stroke for drawing
    ctx.strokeStyle = '#0F766E';
    ctx.lineWidth = 8;
  }

  function getPoint(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches?.[0];
    const x = (touch ? touch.clientX : e.clientX) - rect.left;
    const y = (touch ? touch.clientY : e.clientY) - rect.top;
    return { x, y };
  }

  function start(e) {
    e.preventDefault();
    drawingRef.current = true;
    const { x, y } = getPoint(e);
    const ctx = ctxRef.current;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e) {
    if (!drawingRef.current) return;
    e.preventDefault();
    const { x, y } = getPoint(e);
    const ctx = ctxRef.current;
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function end() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    setStrokes((s) => s + 1);
  }

  function clear() {
    drawGhost();
    setStrokes(0);
  }

  function finish() {
    onComplete?.();
  }

  const done = strokes >= targetCount;

  return (
    <div>
      <p className="text-center text-stone-500 mb-3 font-medium">
        مرّر إصبعك فوق الحرف
        <span className="mx-2 text-stone-400">·</span>
        <span className="text-[var(--color-bedaya-teal)] font-bold">{strokes}/{targetCount}</span>
      </p>
      <div className="rounded-3xl border-2 border-stone-200 overflow-hidden bg-white" style={{ touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          className="block w-full"
          style={{ height: '240px' }}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
      <div className="flex gap-3 mt-4">
        <button
          type="button"
          onClick={clear}
          className="flex-1 py-3 rounded-2xl border-2 border-stone-200 text-stone-700 font-bold flex items-center justify-center gap-2"
        >
          <RotateCcw size={16} />
          إعادة
        </button>
        <button
          type="button"
          onClick={finish}
          disabled={!done}
          className="flex-1 py-3 rounded-2xl bg-[var(--color-bedaya-teal)] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check size={16} />
          تم
        </button>
      </div>
    </div>
  );
}
