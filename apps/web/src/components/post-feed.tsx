'use client';

import { Newspaper, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Page, Post, Tag } from '@/lib/types';
import { Composer } from './composer';
import { PostCard } from './post-card';
import { CardSkeleton, EmptyState, Spinner } from './ui';

/**
 * Server renders the first page (SEO + instant paint); once the session is known we refetch it
 * so per-viewer state (liked) is correct. "Load more" uses cursor pagination.
 */
export function PostFeed({ initial, tag, author, suggestions, showComposer = true }: {
  initial: Page<Post> | null; tag?: string; author?: string; suggestions: Tag[]; showComposer?: boolean;
}) {
  const { user, ready } = useAuth();
  const [items, setItems] = useState<Post[]>(initial?.items ?? []);
  const [cursor, setCursor] = useState<string | null>(initial?.nextCursor ?? null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(initial === null);

  const qs = useCallback((c?: string | null) => {
    const p = new URLSearchParams({ limit: '15' });
    if (c) p.set('cursor', c);
    if (tag) p.set('tag', tag);
    if (author) p.set('author', author);
    return `/community/posts?${p}`;
  }, [tag, author]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<Page<Post>>(qs());
      setItems(d.items); setCursor(d.nextCursor); setFailed(false);
    } catch { setFailed(items.length === 0); } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  useEffect(() => { if (ready && (user || failed)) void reload(); }, [ready, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function more() {
    setLoading(true);
    try {
      const d = await api<Page<Post>>(qs(cursor));
      setItems((s) => [...s, ...d.items]); setCursor(d.nextCursor);
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      {showComposer && <Composer suggestions={suggestions} onCreated={(p) => setItems((s) => [p, ...s])} />}
      {tag && (
        <div className="flex items-center gap-2 text-sm"><span className="text-mute">تصفية بالوسم:</span><span className="chip">#{tag}</span>
          <Link href="/community" className="btn-ghost !p-1.5" aria-label="إزالة التصفية"><X size={14} /></Link></div>
      )}
      {items.map((p) => <PostCard key={p.id} post={p} onRemoved={(id) => setItems((s) => s.filter((x) => x.id !== id))} />)}
      {loading && items.length === 0 && <><CardSkeleton /><CardSkeleton /></>}
      {!loading && items.length === 0 && (
        <EmptyState icon={<Newspaper />} title={failed ? 'تعذّر تحميل المنشورات' : 'لا توجد منشورات بعد'} hint={failed ? 'تحقق من الاتصال ثم أعد المحاولة.' : 'كن أول من يشارك في هذا الركن من المجتمع.'}
          action={failed ? <button className="btn-primary" onClick={reload}>إعادة المحاولة</button> : undefined} />
      )}
      {cursor && <div className="flex justify-center pt-2"><button className="btn-outline" onClick={more} disabled={loading}>{loading ? <Spinner /> : 'عرض المزيد'}</button></div>}
    </div>
  );
}
