'use client';

import clsx from 'clsx';
import { BadgeCheck, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { initials, isExpert, ROLE_LABEL } from '@/lib/format';
import type { Author, Tag } from '@/lib/types';

const PALETTE = ['from-emerald-500 to-teal-700', 'from-amber-500 to-orange-700', 'from-sky-500 to-indigo-700', 'from-rose-500 to-pink-700', 'from-lime-500 to-green-700', 'from-violet-500 to-purple-700'];
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export function Avatar({ name, seed, size = 40 }: { name: string; seed?: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className={clsx('inline-flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br font-bold text-white', PALETTE[hash(seed ?? name) % PALETTE.length])}
    >
      {initials(name) || '؟'}
    </span>
  );
}

export function ExpertBadge({ author, full }: { author: Pick<Author, 'role' | 'verification'>; full?: boolean }) {
  if (author.role === 'ADMIN') return <span className="rounded-full bg-gold-500/15 px-2 py-0.5 text-[11px] font-semibold text-gold-600">الإدارة</span>;
  if (!isExpert(author)) return null;
  return (
    <span title="خبير موثّق" className="inline-flex items-center gap-1 rounded-full bg-gold-500/15 px-2 py-0.5 text-[11px] font-semibold text-gold-600">
      <BadgeCheck size={13} aria-hidden /> {full ? ROLE_LABEL[author.role] : 'خبير موثّق'}
    </span>
  );
}

export function TagChips({ tags }: { tags: Tag[] }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <Link key={t.slug} href={`/community?tag=${encodeURIComponent(t.slug)}`} className="chip">#{t.label}</Link>
      ))}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('animate-spin', className)} size={18} aria-label="جارٍ التحميل" />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-xl bg-line/70', className)} />;
}

export function CardSkeleton() {
  return (
    <div className="card space-y-3 p-5">
      <div className="flex items-center gap-3"><Skeleton className="h-10 w-10 !rounded-full" /><Skeleton className="h-4 w-40" /></div>
      <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" />
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">{icon}</div>
      <h3 className="text-base font-bold">{title}</h3>
      {hint && <p className="max-w-sm text-sm text-mute">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

// ───────────── toast ─────────────
type ToastKind = 'ok' | 'err';
const ToastCtx = createContext<(msg: string, kind?: ToastKind) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: ToastKind }[]>([]);
  const push = useCallback((msg: string, kind: ToastKind = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, msg, kind }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {items.map((t) => (
          <div key={t.id} className={clsx('pointer-events-auto animate-rise rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg', t.kind === 'ok' ? 'bg-brand-900 text-bg' : 'bg-red-600 text-white')}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function Disclaimer() {
  return (
    <p className="rounded-xl border border-gold-500/40 bg-gold-500/10 px-4 py-3 text-xs leading-relaxed text-ink/80">
      ⚖️ المحتوى هنا آراء ونقاشات مجتمعية لأغراض معرفية، <b>ولا يُعد استشارة قانونية</b>. للحالات الرسمية راجع الجهة المختصة
      (وزارة الموارد البشرية والتنمية الاجتماعية أو محامٍ مرخّص).
    </p>
  );
}
