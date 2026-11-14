'use client';

import clsx from 'clsx';
import { ArrowRight, CheckCheck, Mail, Search, Send, ShieldBan } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Avatar, EmptyState, ExpertBadge, Spinner, useToast } from '@/components/ui';
import { API_URL, api, getToken } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
import type { Author, Conversation, Message, Page } from '@/lib/types';

type MsgPage = Page<Message> & { peerLastRead: string | null };

function Chat() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  const [convs, setConvs] = useState<Conversation[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [peerRead, setPeerRead] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Author[]>([]);
  const bottom = useRef<HTMLDivElement>(null);
  const activeRef = useRef<string | null>(null);
  activeRef.current = active;

  useEffect(() => { if (ready && !user) router.replace('/login?next=/messages'); }, [ready, user, router]);

  const loadList = useCallback(async () => {
    const c = await api<Conversation[]>('/messages/conversations');
    setConvs(c);
    window.dispatchEvent(new Event('hrone:unread'));
  }, []);

  const open = useCallback(async (id: string) => {
    setActive(id);
    const d = await api<MsgPage>(`/messages/conversations/${id}/messages?limit=50`);
    setMsgs([...d.items].reverse()); setPeerRead(d.peerLastRead);
    await api(`/messages/conversations/${id}/read`, { method: 'POST' }).catch(() => {});
    void loadList();
  }, [loadList]);

  // Start a chat from ?to=username
  const to = params.get('to');
  useEffect(() => {
    if (!user || !to) return;
    api<{ id: string }>('/messages/conversations', { method: 'POST', body: { username: to } })
      .then((c) => { router.replace('/messages'); return open(c.id); }).catch((e) => toast(e.message, 'err'));
  }, [user?.id, to]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (user) void loadList().catch(() => setConvs([])); }, [user?.id, loadList]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime
  useEffect(() => {
    const token = getToken();
    if (!user || !token) return;
    const s: Socket = io(API_URL.replace(/\/api$/, ''), { auth: { token }, transports: ['websocket'] });
    s.on('message:new', (m: Message) => {
      if (m.conversationId === activeRef.current) {
        setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
        void api(`/messages/conversations/${m.conversationId}/read`, { method: 'POST' }).catch(() => {});
      }
      void loadList();
    });
    s.on('message:read', (e: { conversationId: string; at: string }) => { if (e.conversationId === activeRef.current) setPeerRead(e.at); });
    return () => { s.close(); };
  }, [user?.id, loadList]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs.length, active]);

  useEffect(() => {
    if (q.trim().length < 2) return setResults([]);
    const t = setTimeout(() => api<Author[]>(`/users/search?q=${encodeURIComponent(q)}`).then(setResults).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);

  async function startWith(username: string) {
    try { const c = await api<{ id: string }>('/messages/conversations', { method: 'POST', body: { username } }); setQ(''); setResults([]); await open(c.id); } catch (e) { toast((e as Error).message, 'err'); }
  }

  async function send() {
    const body = text.trim();
    if (!body || !active || !user) return;
    const clientMsgId = crypto.randomUUID();
    const temp: Message = { id: `tmp-${clientMsgId}`, conversationId: active, senderId: user.id, body, createdAt: new Date().toISOString(), clientMsgId };
    setMsgs((s) => [...s, temp]); setText('');
    try {
      const real = await api<Message>(`/messages/conversations/${active}/messages`, { method: 'POST', body: { body, clientMsgId } });
      setMsgs((s) => s.map((m) => (m.id === temp.id ? real : m)));
      void loadList();
    } catch (e) { setMsgs((s) => s.filter((m) => m.id !== temp.id)); setText(body); toast((e as Error).message, 'err'); }
  }

  const current = useMemo(() => convs?.find((c) => c.id === active), [convs, active]);

  async function toggleBlock() {
    if (!current) return;
    const blocked = current.blockedByMe;
    if (!blocked && !confirm(`حظر ${current.peer.displayName}؟ لن تتمكنا من تبادل الرسائل.`)) return;
    try {
      await api(`/users/${current.peer.username}/block`, { method: blocked ? 'DELETE' : 'POST' });
      setConvs((s) => s?.map((c) => (c.id === current.id ? { ...c, blockedByMe: !blocked } : c)) ?? s);
      toast(blocked ? 'أُلغي الحظر' : 'تم الحظر');
    } catch (e) { toast((e as Error).message, 'err'); }
  }
  const lastMine = [...msgs].reverse().find((m) => m.senderId === user?.id);
  if (!user) return <div className="py-20"><Spinner className="mx-auto" /></div>;

  return (
    <div className="card grid h-[calc(100dvh-10rem)] min-h-[480px] overflow-hidden md:grid-cols-[320px_1fr]">
      {/* conversation list */}
      <section className={clsx('flex min-h-0 flex-col border-line md:border-e', active && 'hidden md:flex')} aria-label="المحادثات">
        <div className="space-y-2 border-b border-line p-3">
          <h1 className="px-1 text-lg font-extrabold">الرسائل</h1>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute right-3 top-3 text-mute" />
            <input className="input !pr-9" placeholder="ابحث عن مستخدم لبدء محادثة…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث عن مستخدم" />
            {results.length > 0 && (
              <ul className="card absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-auto p-1">
                {results.map((r) => (
                  <li key={r.id}><button className="flex w-full items-center gap-2 rounded-lg p-2 text-start hover:bg-brand-50" onClick={() => startWith(r.username)}>
                    <Avatar name={r.displayName} seed={r.username} size={32} /><span className="min-w-0 flex-1"><b className="block truncate text-sm">{r.displayName}</b><span className="text-xs text-mute" dir="ltr">@{r.username}</span></span><ExpertBadge author={r} /></button></li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-auto">
          {convs === null && <li className="p-6"><Spinner className="mx-auto" /></li>}
          {convs?.length === 0 && <li className="p-6 text-center text-sm text-mute">لا توجد محادثات بعد. ابحث عن زميل أو خبير وابدأ.</li>}
          {convs?.map((c) => (
            <li key={c.id}>
              <button onClick={() => open(c.id)} className={clsx('flex w-full items-center gap-3 border-b border-line/60 px-4 py-3 text-start transition hover:bg-brand-50', c.id === active && 'bg-brand-50')}>
                <Avatar name={c.peer.displayName} seed={c.peer.username} size={42} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2"><b className="truncate text-sm">{c.peer.displayName}</b><time className="shrink-0 text-[11px] text-mute">{timeAgo(c.lastMessageAt)}</time></span>
                  <span className="flex items-center justify-between gap-2"><span className="truncate text-xs text-mute">{c.lastMessage ? (c.lastMessage.senderId === user.id ? 'أنت: ' : '') + c.lastMessage.body : 'ابدأ المحادثة'}</span>
                    {c.unread > 0 && <span className="rounded-full bg-gold-500 px-1.5 text-[10px] font-bold text-white">{c.unread}</span>}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* thread */}
      <section className={clsx('flex min-h-0 flex-col', !active && 'hidden md:flex')} aria-label="المحادثة الحالية">
        {!active || !current ? (
          <div className="m-auto p-6"><EmptyState icon={<Mail />} title="اختر محادثة" hint="رسائلك خاصة بينك وبين الطرف الآخر." /></div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-line p-3">
              <button className="btn-ghost !p-2 md:hidden" aria-label="رجوع" onClick={() => setActive(null)}><ArrowRight size={18} /></button>
              <Avatar name={current.peer.displayName} seed={current.peer.username} size={38} />
              <div className="min-w-0"><b className="block truncate text-sm">{current.peer.displayName}</b><div className="flex items-center gap-2"><span className="truncate text-xs text-mute">{current.peer.headline ?? `@${current.peer.username}`}</span><ExpertBadge author={current.peer} /></div></div>
              <button className="btn-ghost ms-auto !px-2.5" onClick={toggleBlock} aria-label={current.blockedByMe ? 'إلغاء الحظر' : 'حظر المستخدم'} title={current.blockedByMe ? 'إلغاء الحظر' : 'حظر'}><ShieldBan size={18} className={current.blockedByMe ? 'text-red-500' : ''} /></button>
            </header>
            <div className="min-h-0 flex-1 space-y-2 overflow-auto bg-bg/50 p-4" role="log" aria-live="polite">
              {msgs.map((m) => {
                const mine = m.senderId === user.id;
                return (
                  <div key={m.id} className={clsx('flex', mine ? 'justify-start' : 'justify-end')}>
                    <div className={clsx('max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-7', mine ? 'rounded-ss-md bg-brand-600 text-white dark:text-[#06120d]' : 'rounded-se-md border border-line bg-surface', m.id.startsWith('tmp-') && 'opacity-60')}>
                      {m.body}
                      <div className={clsx('mt-0.5 flex items-center gap-1 text-[10px]', mine ? 'opacity-75' : 'text-mute')}>{timeAgo(m.createdAt)}
                        {mine && m.id === lastMine?.id && peerRead && new Date(peerRead) >= new Date(m.createdAt) && <CheckCheck size={12} aria-label="مقروءة" />}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottom} />
            </div>
            {current.blockedByMe ? (
              <p className="border-t border-line p-4 text-center text-sm text-mute">لقد حظرت هذا المستخدم. <button className="font-semibold text-brand-600 underline" onClick={toggleBlock}>إلغاء الحظر</button> لاستئناف المراسلة.</p>
            ) : (
            <form className="flex items-end gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); void send(); }}>
              <textarea rows={1} className="input max-h-32 resize-none" value={text} maxLength={2000} placeholder="اكتب رسالتك…" aria-label="الرسالة"
                onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} />
              <button className="btn-primary !px-3.5 !py-3" disabled={!text.trim()} aria-label="إرسال"><Send size={17} className="-scale-x-100" /></button>
            </form>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default function MessagesPage() {
  return <Suspense><Chat /></Suspense>;
}
