import { useCallback, useEffect, useRef, useState } from 'react';

// Drag-to-resize for the workspace panes. Remembers the size per key.
export function useSplit({ key, initial, min, max, axis = 'x', containerRef, invert = false }) {
  const read = () => {
    try { const v = Number(localStorage.getItem(key)); return Number.isFinite(v) && v > 0 ? v : initial; } catch { return initial; }
  };
  const [size, setSize] = useState(read);
  const [dragging, setDragging] = useState(false);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
    const rect = containerRef.current.getBoundingClientRect();
    const move = (ev) => {
      let v;
      if (axis === 'x') v = ((ev.clientX - rect.left) / rect.width) * 100; // percent
      else v = invert ? rect.bottom - ev.clientY : ev.clientY - rect.top; // px
      setSize(Math.min(max, Math.max(min, v)));
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      try { localStorage.setItem(key, String(sizeRef.current)); } catch { /* ignore */ }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [axis, containerRef, invert, key, max, min]);

  useEffect(() => {
    if (!dragging) return;
    const prev = document.body.style.cursor;
    document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    return () => { document.body.style.cursor = prev; document.body.style.userSelect = ''; };
  }, [dragging, axis]);

  return { size, setSize, dragging, handleProps: { onPointerDown, className: `resizer ${axis === 'x' ? 'resizer-x' : 'resizer-y'} ${dragging ? 'active' : ''}`, role: 'separator', 'aria-orientation': axis === 'x' ? 'vertical' : 'horizontal' } };
}

export function useMediaQuery(query) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}
