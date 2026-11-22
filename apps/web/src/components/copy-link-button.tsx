'use client';

import { Link2 } from 'lucide-react';
import { useToast } from './ui';

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / insecure context fallback.
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    try { return document.execCommand('copy'); } catch { return false; } finally { ta.remove(); }
  }
}

export function CopyLinkButton({ path, label = 'تم نسخ رابط الاستشارة بنجاح' }: { path: string; label?: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      className="btn-ghost !px-2 !py-1 text-xs"
      aria-label="نسخ رابط الاستشارة"
      title="نسخ الرابط"
      onClick={async () => (await copy(`${location.origin}${path}`)) ? toast(label) : toast('تعذّر نسخ الرابط', 'err')}
    >
      <Link2 size={14} /> نسخ الرابط
    </button>
  );
}
