'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

type Disposable = { dispose: () => void };

/**
 * Loads Bootstrap's JS lazily (never during SSR) and wires Tooltip / Popover to any element carrying
 * data-bs-toggle="tooltip|popover", including nodes that appear later (client-side fetches, route changes).
 * Only the two plugins we use are imported, not the whole bundle.
 */
export function BootstrapClient() {
  const pathname = usePathname();

  useEffect(() => {
    let alive = true;
    let observer: MutationObserver | undefined;
    let raf = 0;

    (async () => {
      const [{ default: Tooltip }, { default: Popover }] = await Promise.all([
        import('bootstrap/js/dist/tooltip'),
        import('bootstrap/js/dist/popover'),
      ]);
      if (!alive) return;

      const scan = (root: ParentNode = document) => {
        root.querySelectorAll<HTMLElement>('[data-bs-toggle="tooltip"]').forEach((el) => Tooltip.getOrCreateInstance(el));
        root.querySelectorAll<HTMLElement>('[data-bs-toggle="popover"]').forEach((el) =>
          Popover.getOrCreateInstance(el, { trigger: 'hover focus', placement: 'top', container: 'body', customClass: 'hr-popover' }),
        );
      };
      const release = (node: Node) => {
        if (!(node instanceof HTMLElement)) return;
        const els = [node, ...node.querySelectorAll<HTMLElement>('[data-bs-toggle]')];
        for (const el of els) {
          (Tooltip.getInstance(el) as Disposable | null)?.dispose();
          (Popover.getInstance(el) as Disposable | null)?.dispose();
        }
      };

      scan();
      observer = new MutationObserver((muts) => {
        for (const m of muts) m.removedNodes.forEach(release);
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => scan());
      });
      observer.observe(document.body, { childList: true, subtree: true });
    })();

    return () => { alive = false; cancelAnimationFrame(raf); observer?.disconnect(); };
  }, []);

  // Close any popover left open when navigating.
  useEffect(() => { document.querySelectorAll('.popover').forEach((p) => p.remove()); }, [pathname]);

  return null;
}
