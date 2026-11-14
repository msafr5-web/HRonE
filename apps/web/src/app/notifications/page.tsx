'use client';

import clsx from 'clsx';
import { Bell, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Avatar, CardSkeleton, EmptyState, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
import { notificationHref, notificationText, type Notification } from '@/lib/notifications';
import type { Page } from '@/lib/types';

export default function NotificationsPage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Notification[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (ready && !user) router.replace('/login?next=/notifications'); }, [ready, user, router]);

  const load = useCallback(async (c?: string | null) => {
    setLoading(true);
    try {
      const d = await api<Page<Notification>>(`/notifications?limit=20${c ? `&cursor=${c}` : ''}`);
      setItems((s) => (c ? [...(s ?? []), ...d.items] : d.items)); setCursor(d.nextCursor);
    } catch { setItems((s) => s ?? []); } finally { setLoading(false); }
  }, []);
  useEffect(() => { if (user) void load(); }, [user?.id, load]); // eslint-disable-line react-hooks/exhaustive-deps

  async function open(n: Notification) {
    if (!n.readAt) { void api(`/notifications/${n.id}/read`, { method: 'POST' }).then(() => window.dispatchEvent(new Event('hrone:notifications'))).catch(() => {}); }
    router.push(notificationHref(n));
  }
  async function readAll() {
    await api('/notifications/read-all', { method: 'POST' }).catch(() => {});
    setItems((s) => s?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? s);
    window.dispatchEvent(new Event('hrone:notifications'));
  }

  if (!user) return <Spinner className="mx-auto mt-20" />;
  const hasUnread = items?.some((n) => !n.readAt);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-extrabold">الإشعارات</h1>
        <button className="btn-outline" onClick={readAll} disabled={!hasUnread}><CheckCheck size={16} /> تعليم الكل كمقروء</button></div>
      {items === null && <><CardSkeleton /><CardSkeleton /></>}
      {items?.length === 0 && <EmptyState icon={<Bell />} title="لا توجد إشعارات بعد" hint="ستصلك هنا الإعجابات والتعليقات والإجابات والمتابعات." />}
      {items && items.length > 0 && (
        <ul className="card divide-y divide-line overflow-hidden">
          {items.map((n) => (
            <li key={n.id}>
              <button onClick={() => open(n)} className={clsx('flex w-full items-start gap-3 px-5 py-4 text-start transition hover:bg-brand-50', !n.readAt && 'bg-brand-50/60')}>
                {n.actor ? <Avatar name={n.actor.displayName} seed={n.actor.username} size={40} /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-500/20 text-xs font-bold text-gold-600">HR</span>}
                <span className="min-w-0 flex-1"><span className="block text-sm leading-6">{notificationText(n)}</span>
                  {n.preview && <span className="line-clamp-2 block text-sm text-mute">{n.preview}</span>}
                  <time className="text-xs text-mute">{timeAgo(n.createdAt)}</time></span>
                {!n.readAt && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-gold-500" aria-label="غير مقروء" />}
              </button>
            </li>
          ))}
        </ul>
      )}
      {cursor && <div className="flex justify-center"><button className="btn-outline" disabled={loading} onClick={() => load(cursor)}>{loading ? <Spinner /> : 'عرض المزيد'}</button></div>}
    </div>
  );
}
