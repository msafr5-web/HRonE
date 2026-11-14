'use client';

import clsx from 'clsx';
import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
import { notificationHref, notificationText, type Notification } from '@/lib/notifications';
import type { Page } from '@/lib/types';
import { Avatar, Spinner } from './ui';

export function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(() => api<{ unread: number }>('/notifications/unread-count').then((d) => setUnread(d.unread)).catch(() => {}), []);

  useEffect(() => {
    if (!user) return setUnread(0);
    void refreshCount();
    const t = setInterval(refreshCount, 30_000);
    const onFocus = () => void refreshCount();
    window.addEventListener('focus', onFocus);
    window.addEventListener('hrone:notifications', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); window.removeEventListener('hrone:notifications', onFocus); };
  }, [user, refreshCount]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setItems(null);
      const d = await api<Page<Notification> & { unread: number }>('/notifications?limit=8').catch(() => null);
      setItems(d?.items ?? []);
      if (d) setUnread(d.unread);
    }
  }

  async function go(n: Notification) {
    setOpen(false);
    if (!n.readAt) { setUnread((u) => Math.max(0, u - 1)); void api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {}); }
    router.push(notificationHref(n));
  }

  async function readAll() {
    await api('/notifications/read-all', { method: 'POST' }).catch(() => {});
    setUnread(0);
    setItems((s) => s?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? s);
  }

  if (!user) return null;
  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="btn-ghost relative !p-2" aria-haspopup="menu" aria-expanded={open} aria-label={unread ? `الإشعارات (${unread} جديد)` : 'الإشعارات'}>
        <Bell size={18} />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div role="menu" className="card fixed inset-x-3 top-[4.5rem] z-40 max-h-[75vh] animate-rise overflow-hidden sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-2 sm:w-96">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <b className="text-sm">الإشعارات</b>
            <button className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline disabled:opacity-40" onClick={readAll} disabled={unread === 0}><CheckCheck size={14} /> تعليم الكل كمقروء</button>
          </div>
          <ul className="max-h-[55vh] overflow-auto">
            {items === null && <li className="p-6"><Spinner className="mx-auto" /></li>}
            {items?.length === 0 && <li className="p-8 text-center text-sm text-mute">لا توجد إشعارات بعد.</li>}
            {items?.map((n) => (
              <li key={n.id}>
                <button onClick={() => go(n)} className={clsx('flex w-full items-start gap-3 border-b border-line/60 px-4 py-3 text-start transition hover:bg-brand-50', !n.readAt && 'bg-brand-50/60')}>
                  {n.actor ? <Avatar name={n.actor.displayName} seed={n.actor.username} size={34} /> : <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-gold-500/20 text-xs font-bold text-gold-600">HR</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-6">{notificationText(n)}</span>
                    {n.preview && <span className="line-clamp-1 block text-xs text-mute">{n.preview}</span>}
                    <time className="text-[11px] text-mute">{timeAgo(n.createdAt)}</time>
                  </span>
                  {!n.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-gold-500" aria-label="غير مقروء" />}
                </button>
              </li>
            ))}
          </ul>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-3 text-center text-sm font-semibold text-brand-600 hover:bg-brand-50">عرض كل الإشعارات</Link>
        </div>
      )}
    </div>
  );
}
