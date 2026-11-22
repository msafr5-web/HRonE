'use client';

import clsx from 'clsx';
import { CATEGORY_LABEL, categoryOf } from '@/lib/categories';
import { RichText } from './rich-text';
import { CheckCircle2, ChevronDown, ChevronUp, CornerDownLeft, Lock, UserX } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
import type { Reply, Thread } from '@/lib/types';
import { ReportButton } from './report-button';
import { Avatar, Disclaimer, ExpertBadge, Spinner, TagChips, useToast } from './ui';

export function ThreadView({ initial }: { initial: Thread }) {
  const { user, ready } = useAuth();
  const toast = useToast();
  const [thread, setThread] = useState<Thread>(initial);
  const [replies, setReplies] = useState<Reply[] | null>(null);
  const [locked, setLocked] = useState(initial.locked);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const t = await api<Thread>(`/consultations/${initial.id}`);
      setThread(t); setLocked(t.locked);
      if (t.locked) return setReplies([]);
      setReplies(await api<Reply[]>(`/consultations/${initial.id}/replies`));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PREMIUM_REQUIRED') { setLocked(true); setReplies([]); } else setReplies([]);
    }
  }, [initial.id]);
  useEffect(() => { if (ready) void load(); }, [ready, user?.id, load]);

  const { tops, kids } = useMemo(() => {
    const all = replies ?? [];
    const kids = new Map<string, Reply[]>();
    all.filter((r) => r.parentId).forEach((r) => kids.set(r.parentId!, [...(kids.get(r.parentId!) ?? []), r]));
    const tops = all.filter((r) => !r.parentId).sort((a, b) => Number(b.accepted) - Number(a.accepted) || b.score - a.score || +new Date(a.createdAt) - +new Date(b.createdAt));
    return { tops, kids };
  }, [replies]);

  async function post(parentId?: string, body = text, done?: () => void) {
    setBusy(true);
    try {
      const r = await api<Reply>(`/consultations/${thread.id}/replies`, { method: 'POST', body: { body, parentId } });
      setReplies((s) => [...(s ?? []), r]);
      setThread((t) => ({ ...t, replyCount: t.replyCount + 1 }));
      done ? done() : setText('');
    } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
  }

  async function vote(r: Reply, value: -1 | 1) {
    if (!user) return toast('سجّل الدخول للتصويت', 'err');
    const next = r.viewerVote === value ? 0 : value;
    const prev = replies;
    setReplies((s) => s!.map((x) => (x.id === r.id ? { ...x, viewerVote: next, score: x.score + next - x.viewerVote } : x)));
    try {
      const res = await api<{ score: number; viewerVote: -1 | 0 | 1 }>(`/consultations/replies/${r.id}/vote`, { method: 'POST', body: { value: next } });
      setReplies((s) => s!.map((x) => (x.id === r.id ? { ...x, ...res } : x)));
    } catch (e) { setReplies(prev); toast((e as Error).message, 'err'); }
  }

  async function accept(r: Reply) {
    try {
      if (r.accepted) await api(`/consultations/${thread.id}/accept`, { method: 'DELETE' });
      else await api(`/consultations/${thread.id}/accept/${r.id}`, { method: 'POST' });
      setReplies((s) => s!.map((x) => ({ ...x, accepted: !r.accepted && x.id === r.id })));
      setThread((t) => ({ ...t, solved: !r.accepted, acceptedReplyId: r.accepted ? null : r.id }));
      toast(r.accepted ? 'أُلغي اعتماد الإجابة' : 'تم اعتماد الإجابة 🎉');
    } catch (e) { toast((e as Error).message, 'err'); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <article className={`card cat-border cat-${categoryOf(thread.tags)} p-6`}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="cat-label">{CATEGORY_LABEL[categoryOf(thread.tags)]}</span>
          {thread.solved && <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 font-semibold text-brand-700"><CheckCircle2 size={13} /> تمت الإجابة</span>}
          {thread.isPremium && <span className="inline-flex items-center gap-1 rounded-full bg-ink/10 px-2 py-0.5 font-semibold"><Lock size={12} /> مميّز</span>}
        </div>
        <h1 className="mt-2 text-2xl font-extrabold leading-snug">{thread.title}</h1>
        <div className="mt-3 flex items-center gap-2 text-sm text-mute">
          {thread.author ? <Link href={`/u/${thread.author.username}`} className="flex items-center gap-2 hover:text-ink"><Avatar name={thread.author.displayName} seed={thread.author.username} size={28} /><b className="text-ink">{thread.author.displayName}</b><ExpertBadge author={thread.author} /></Link>
            : <span className="flex items-center gap-2"><UserX size={18} /> عضو مجهول{thread.mine && ' (أنت)'}</span>}
          <span>·</span><time dateTime={thread.createdAt}>{timeAgo(thread.createdAt)}</time>
          <span className="ms-auto"><ReportButton type="THREAD" id={thread.id} /></span>
        </div>
        <p className="mt-5 whitespace-pre-wrap break-words text-[15px] leading-8"><RichText text={thread.body} /></p>
        {thread.tags.length > 0 && <div className="mt-4"><TagChips tags={thread.tags} /></div>}
      </article>

      <Disclaimer />

      {locked ? (
        <div className="card flex flex-col items-center gap-3 border-gold-500/40 p-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-500/15 text-gold-600"><Lock /></span>
          <h2 className="text-lg font-bold">هذا المحتوى للمشتركين</h2>
          <p className="max-w-md text-sm text-mute">المحتوى المميّز يُعدّه خبراء موثّقون. الاشتراكات قيد التفعيل وسنعلن عن الباقات قريباً.</p>
          {!user && <Link href="/login" className="btn-primary">سجّل الدخول</Link>}
        </div>
      ) : (
        <section aria-labelledby="answers">
          <h2 id="answers" className="mb-3 text-lg font-bold">{thread.replyCount} {thread.replyCount === 1 ? 'إجابة' : 'إجابات'}</h2>
          {replies === null ? <Spinner className="mx-auto my-10" /> : (
            <ul className="space-y-4">
              {tops.map((r) => (
                <ReplyItem key={r.id} r={r} canAccept={thread.mine || user?.role === 'ADMIN'} onVote={vote} onAccept={accept}
                  onReply={(body, done) => post(r.id, body, done)} busy={busy} loggedIn={!!user}>
                  {(kids.get(r.id) ?? []).map((k) => <ReplyItem key={k.id} r={k} nested onVote={vote} loggedIn={!!user} />)}
                </ReplyItem>
              ))}
              {tops.length === 0 && <li className="card empty-dashed p-8 text-center text-sm text-mute">لا توجد إجابات بعد — كن أول من يساعد.</li>}
            </ul>
          )}

          <div className="card mt-6 p-5">
            <h3 className="mb-2 text-sm font-bold">إجابتك</h3>
            {user ? (
              <div className="space-y-3">
                <textarea className="input min-h-[120px] leading-7" maxLength={3000} value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب إجابة واضحة ومفيدة، وأشِر إلى المادة النظامية إن أمكن…" aria-label="إجابتك" />
                <div className="flex justify-end"><button className="btn-primary" disabled={busy || text.trim().length < 2} onClick={() => post()}>{busy ? <Spinner /> : 'نشر الإجابة'}</button></div>
              </div>
            ) : <p className="text-sm text-mute"><Link className="font-semibold text-brand-600 underline" href={`/login?next=/consultations/${thread.id}`}>سجّل الدخول</Link> لتشارك إجابتك.</p>}
          </div>
        </section>
      )}
    </div>
  );
}

function ReplyItem({ r, nested, canAccept, onVote, onAccept, onReply, busy, loggedIn, children }: {
  r: Reply; nested?: boolean; canAccept?: boolean; loggedIn: boolean; busy?: boolean;
  onVote: (r: Reply, v: -1 | 1) => void; onAccept?: (r: Reply) => void; onReply?: (body: string, done: () => void) => void; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [t, setT] = useState('');
  return (
    <li className={clsx(nested ? 'mt-3 border-s-2 border-line ps-4' : 'card p-5', r.accepted && 'ring-2 ring-brand-500/40', r.asExpert && !nested && 'border-gold-500/50')}>
      {r.accepted && <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-brand-600"><CheckCircle2 size={15} /> الإجابة المعتمدة</p>}
      <div className="flex gap-3">
        <div className="flex flex-col items-center text-mute">
          <button aria-label="تصويت إيجابي" aria-pressed={r.viewerVote === 1} onClick={() => onVote(r, 1)} className={clsx('rounded-lg p-1 hover:bg-brand-50', r.viewerVote === 1 && 'text-brand-600')}><ChevronUp size={22} /></button>
          <span className="text-sm font-bold text-ink" aria-label={`النتيجة ${r.score}`}>{r.score}</span>
          <button aria-label="تصويت سلبي" aria-pressed={r.viewerVote === -1} onClick={() => onVote(r, -1)} className={clsx('rounded-lg p-1 hover:bg-brand-50', r.viewerVote === -1 && 'text-red-500')}><ChevronDown size={22} /></button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link href={`/u/${r.author.username}`} className="flex items-center gap-2 font-bold"><Avatar name={r.author.displayName} seed={r.author.username} size={26} />{r.author.displayName}</Link>
            {r.asExpert && <ExpertBadge author={{ role: r.author.role === 'EMPLOYEE' ? 'HR_SPECIALIST' : r.author.role, verification: 'VERIFIED' }} full />}
            <span className="text-xs text-mute">{timeAgo(r.createdAt)}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-8"><RichText text={r.body} /></p>
          <div className="mt-3 flex flex-wrap items-center gap-1 text-xs">
            {!nested && loggedIn && <button className="btn-ghost !px-2 !py-1" onClick={() => setOpen((o) => !o)}><CornerDownLeft size={14} /> رد</button>}
            {canAccept && !nested && <button className="btn-ghost !px-2 !py-1 !text-brand-600" onClick={() => onAccept?.(r)}><CheckCircle2 size={14} /> {r.accepted ? 'إلغاء الاعتماد' : 'اعتماد كإجابة'}</button>}
            <span className="ms-auto"><ReportButton type="REPLY" id={r.id} /></span>
          </div>
          {open && (
            <div className="mt-3 space-y-2">
              <textarea className="input min-h-[80px]" value={t} onChange={(e) => setT(e.target.value)} maxLength={3000} aria-label="ردك" />
              <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={() => setOpen(false)}>إلغاء</button>
                <button className="btn-primary" disabled={busy || t.trim().length < 2} onClick={() => onReply?.(t, () => { setT(''); setOpen(false); })}>رد</button></div>
            </div>
          )}
          {children}
        </div>
      </div>
    </li>
  );
}
