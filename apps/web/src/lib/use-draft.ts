'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const PREFIX = 'hr1:draft:';

/**
 * localStorage-backed draft. SSR/hydration-safe: the first render always uses `initial`; the saved draft is
 * restored in an effect. Writes are debounced, wrapped in try/catch (private mode, quota), and the key is
 * removed when the value returns to `initial`. Pass `enabled=false` to stop persisting (and wipe the draft).
 */
export function useDraft<T>(key: string, initial: T, opts: { enabled?: boolean | ((v: T) => boolean); delay?: number } = {}) {
  const { enabled: enabledOpt = true, delay = 600 } = opts;
  const k = PREFIX + key;
  const [value, setValue] = useState<T>(initial);
  const [restored, setRestored] = useState(false);
  const ready = useRef(false);
  const init = useRef(initial);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(k);
      if (raw) { setValue(JSON.parse(raw) as T); setRestored(true); }
    } catch { /* storage unavailable or corrupt: start clean */ }
    ready.current = true;
  }, [k]);

  useEffect(() => {
    if (!ready.current) return;
    const enabled = typeof enabledOpt === 'function' ? enabledOpt(value) : enabledOpt;
    const t = setTimeout(() => {
      try {
        if (!enabled || JSON.stringify(value) === JSON.stringify(init.current)) localStorage.removeItem(k);
        else localStorage.setItem(k, JSON.stringify(value));
      } catch { /* ignore */ }
    }, delay);
    return () => clearTimeout(t);
  }, [value, enabledOpt, delay, k]);

  const clear = useCallback(() => {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
    setValue(init.current);
    setRestored(false);
  }, [k]);

  return { value, setValue, clear, restored };
}
