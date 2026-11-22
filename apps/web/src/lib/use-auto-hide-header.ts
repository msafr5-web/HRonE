'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Hides the sticky header when scrolling down past `threshold`, reveals it immediately on scroll up.
 * Writes a data attribute straight to the DOM (no React re-render per scroll event), rAF-throttled.
 * Stays visible while focus is inside the header (search box, menus) so keyboard users never lose it.
 */
export function useAutoHideHeader(ref: RefObject<HTMLElement | null>, threshold = 120) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let last = window.scrollY;
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const delta = y - last;
      if (Math.abs(delta) < 6) return; // ignore jitter
      const focusedInside = el.contains(document.activeElement) && document.activeElement !== document.body;
      const hide = delta > 0 && y > threshold && !focusedInside;
      el.dataset.hidden = hide ? 'true' : 'false';
      last = y;
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); el.dataset.hidden = 'false'; };
  }, [ref, threshold]);
}
