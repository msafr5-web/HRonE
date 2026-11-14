'use client';

import { MessagesSquare } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Page, Thread } from '@/lib/types';
import { ThreadCard } from './thread-card';
import { CardSkeleton, EmptyState, Spinner } from './ui';

export function ThreadFeed({ initial, filter, tag }: { initial: Page<Thread> | null; filter: string; tag?: string }) {
  const { user, ready } = useAuth();
  const [items, setItems] = useState<Thread[]>(initial?.items ?? []);
  const [cursor, setCursor] = useState<string | null>(initial?.nextCursor ?? null);
  const [loading, setLoading] = useState(false);

  const qs = useCallback((c?: string | null) => {
    const p = new URLSearchParams({ limit: '15', filter });
    if (c) p.set('cursor', c);
    if (tag) p.set('tag', tag);
    return `/consultations?${p}`;
  }, [filter, tag]);

  // Re-fetch once signed in so premium/ownership flags reflect the viewer.
  useEffect(() => {
    if (!ready || !user) return;
    api<Page<Thread>>(qs()).then((d) => { setItems(d.items); setCursor(d.nextCursor); }).catch(() => {});
  }, [ready, user?.id, qs]); // eslint-disable-line react-hooks/exhaustive-deps

  async function more() {
    setLoading(true);
    try { const d = await api<Page<Thread>>(qs(cursor)); setItems((s) => [...s, ...d.items]); setCursor(d.nextCursor); } finally { setLoading(false); }
  }

  if (initial === null && items.length === 0) return <EmptyState icon={<MessagesSquare />} title="تعذّر تحميل الأسئلة" hint="تحقق من الاتصال ثم أعد تحميل الصفحة." />;
  return (
    <div className="space-y-4">
      {items.length === 0 && !loading && (
        <EmptyState icon={<MessagesSquare />} title="لا توجد أسئلة هنا بعد" hint="ابدأ النقاش بطرح سؤالك على المجتمع." action={<Link href="/consultations/new" className="btn-primary">اطرح سؤالاً</Link>} />
      )}
      {loading && items.length === 0 && <CardSkeleton />}
      {items.map((t) => <ThreadCard key={t.id} t={t} />)}
      {cursor && <div className="flex justify-center"><button className="btn-outline" disabled={loading} onClick={more}>{loading ? <Spinner /> : 'عرض المزيد'}</button></div>}
    </div>
  );
}
