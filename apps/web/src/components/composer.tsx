'use client';

import clsx from 'clsx';
import { Hash, X } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, type KeyboardEvent } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Post, Tag } from '@/lib/types';
import { Avatar, Spinner, useToast } from './ui';

const MAX = 3000;

export function Composer({ suggestions, onCreated }: { suggestions: Tag[]; onCreated: (p: Post) => void }) {
  const { user, ready } = useAuth();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [focus, setFocus] = useState(false);
  const [busy, setBusy] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);

  if (!ready) return <div className="card h-28 animate-pulse" />;
  if (!user) {
    return (
      <div className="card flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:text-start">
        <p className="flex-1 text-sm text-mute">انضم إلى المجتمع لتشارك خبرتك، تطرح سؤالاً، وتتواصل مع الخبراء.</p>
        <div className="flex gap-2"><Link href="/login" className="btn-outline">دخول</Link><Link href="/register" className="btn-primary">إنشاء حساب</Link></div>
      </div>
    );
  }

  const addTag = (raw: string) => {
    const t = raw.replace(/^#+/, '').trim().replace(/\s+/g, '_');
    if (t.length >= 2 && tags.length < 5 && !tags.includes(t)) setTags([...tags, t]);
    setDraft('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ' ', ',', '،'].includes(e.key) && draft.trim()) { e.preventDefault(); addTag(draft); }
    if (e.key === 'Backspace' && !draft && tags.length) setTags(tags.slice(0, -1));
  };

  async function submit() {
    setBusy(true);
    try {
      const post = await api<Post>('/community/posts', { method: 'POST', body: { body, tags } });
      onCreated({ ...post, viewerLiked: false });
      setBody(''); setTags([]); setFocus(false);
      toast('تم نشر منشورك');
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally { setBusy(false); }
  }

  const open = focus || body.length > 0;
  const unused = suggestions.filter((s) => !tags.includes(s.label)).slice(0, 6);
  return (
    <div className={clsx('card p-4 transition-shadow', open && 'ring-2 ring-brand-500/15')}>
      <div className="flex gap-3">
        <Avatar name={user.displayName} seed={user.username} />
        <div className="min-w-0 flex-1">
          <textarea
            ref={ta}
            value={body}
            maxLength={MAX}
            rows={open ? 4 : 2}
            onFocus={() => setFocus(true)}
            onChange={(e) => setBody(e.target.value)}
            aria-label="نص المنشور"
            placeholder="شارك خبرتك، سؤالك، أو تجربة مهنية مع المجتمع…"
            className="w-full resize-none bg-transparent text-[15px] leading-7 placeholder:text-mute/70 focus:outline-none"
          />
          {open && (
            <div className="animate-rise space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {tags.map((t) => (
                  <span key={t} className="chip gap-1">#{t}<button aria-label={`إزالة ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))}><X size={12} /></button></span>
                ))}
                {tags.length < 5 && (
                  <label className="flex items-center gap-1 text-sm text-mute"><Hash size={14} />
                    <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onBlur={() => draft && addTag(draft)} placeholder="أضف وسماً…" className="w-28 bg-transparent focus:outline-none" aria-label="إضافة وسم" />
                  </label>
                )}
              </div>
              {unused.length > 0 && tags.length < 5 && (
                <div className="flex flex-wrap gap-1.5 text-xs text-mute">اقتراحات:
                  {unused.map((s) => <button key={s.slug} className="chip" onClick={() => addTag(s.label)}>#{s.label}</button>)}
                </div>
              )}
              <div className="flex items-center justify-between border-t border-line pt-3">
                <span className={clsx('text-xs', body.length > MAX - 200 ? 'text-red-500' : 'text-mute')}>{body.length}/{MAX}</span>
                <div className="flex gap-2">
                  <button className="btn-ghost" onClick={() => { setFocus(false); setBody(''); setTags([]); }}>إلغاء</button>
                  <button className="btn-primary" disabled={busy || body.trim().length === 0} onClick={submit}>{busy ? <Spinner /> : 'نشر'}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
