'use client';

import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
import type { Comment, Page } from '@/lib/types';
import { ReportButton } from './report-button';
import { Avatar, ExpertBadge, Spinner, useToast } from './ui';

export function Comments({ postId }: { postId: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<Comment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async (c?: string | null) => {
    const d = await api<Page<Comment>>(`/community/posts/${postId}/comments?limit=20${c ? `&cursor=${c}` : ''}`);
    setItems((s) => (c ? [...s, ...d.items] : d.items)); setCursor(d.nextCursor); setLoaded(true);
  };
  useEffect(() => { void load().catch(() => setLoaded(true)); }, [postId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    setBusy(true);
    try {
      const c = await api<Comment>(`/community/posts/${postId}/comments`, { method: 'POST', body: { body: text } });
      setItems((s) => [...s, c]); setText('');
    } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
  }
  async function del(id: string) {
    try { await api(`/community/comments/${id}`, { method: 'DELETE' }); setItems((s) => s.filter((c) => c.id !== id)); } catch (e) { toast((e as Error).message, 'err'); }
  }

  return (
    <section id="comments" className="mt-6 scroll-mt-24">
      <h2 className="mb-3 text-lg font-bold">التعليقات</h2>
      {user ? (
        <div className="card mb-4 flex gap-3 p-4">
          <Avatar name={user.displayName} seed={user.username} size={36} />
          <div className="flex-1 space-y-2">
            <textarea className="input min-h-[72px]" maxLength={1500} value={text} onChange={(e) => setText(e.target.value)} placeholder="أضف تعليقاً مفيداً…" aria-label="تعليق جديد" />
            <div className="flex justify-end"><button className="btn-primary" disabled={busy || !text.trim()} onClick={send}>{busy ? <Spinner /> : 'تعليق'}</button></div>
          </div>
        </div>
      ) : (
        <p className="card mb-4 p-4 text-sm text-mute"><Link className="font-semibold text-brand-600 underline" href="/login">سجّل الدخول</Link> لإضافة تعليق.</p>
      )}
      {!loaded ? <Spinner className="mx-auto" /> : items.length === 0 ? <p className="py-6 text-center text-sm text-mute">لا توجد تعليقات بعد.</p> : (
        <ul className="space-y-3">
          {items.map((c) => (
            <li key={c.id} className="card flex animate-rise gap-3 p-4">
              <Link href={`/u/${c.author.username}`}><Avatar name={c.author.displayName} seed={c.author.username} size={34} /></Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm"><Link href={`/u/${c.author.username}`} className="font-bold">{c.author.displayName}</Link><ExpertBadge author={c.author} /><span className="text-xs text-mute">{timeAgo(c.createdAt)}</span></div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-7">{c.body}</p>
              </div>
              <div className="flex items-start">
                {user && (user.id === c.author.id || user.role === 'ADMIN') && <button className="btn-ghost !p-1.5" aria-label="حذف التعليق" onClick={() => del(c.id)}><Trash2 size={14} /></button>}
                <ReportButton type="COMMENT" id={c.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {cursor && <div className="mt-3 text-center"><button className="btn-outline" onClick={() => load(cursor)}>تعليقات أقدم/أكثر</button></div>}
    </section>
  );
}
