'use client';

import clsx from 'clsx';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { PostCard } from '@/components/post-card';
import { ThreadCard } from '@/components/thread-card';
import { Avatar, CardSkeleton, EmptyState, ExpertBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { ROLE_LABEL } from '@/lib/format';
import type { Author, Page, Post, Thread } from '@/lib/types';

type Tab = 'all' | 'posts' | 'threads' | 'people';
const TABS: [Tab, string][] = [['all', 'الكل'], ['posts', 'المنشورات'], ['threads', 'الأسئلة'], ['people', 'الأشخاص']];

function Results() {
  const router = useRouter();
  const sp = useSearchParams();
  const q = (sp.get('q') ?? '').trim();
  const [input, setInput] = useState(q);
  const [tab, setTab] = useState<Tab>('all');
  const [data, setData] = useState<{ posts: Post[]; threads: Thread[]; people: Author[] } | null>(null);

  useEffect(() => { setInput(q); }, [q]);
  useEffect(() => {
    if (q.length < 2) { setData({ posts: [], threads: [], people: [] }); return; }
    setData(null);
    const e = encodeURIComponent(q);
    let stop = false;
    Promise.all([
      api<Page<Post>>(`/community/posts?limit=10&q=${e}`).then((d) => d.items).catch(() => []),
      api<Page<Thread>>(`/consultations?limit=10&q=${e}`).then((d) => d.items).catch(() => []),
      api<Author[]>(`/users/directory?q=${e}`).catch(() => []),
    ]).then(([posts, threads, people]) => { if (!stop) setData({ posts, threads, people }); });
    return () => { stop = true; };
  }, [q]);

  const submit = (e: FormEvent) => { e.preventDefault(); if (input.trim().length >= 2) router.push(`/search?q=${encodeURIComponent(input.trim())}`); };
  const total = data ? data.posts.length + data.threads.length + data.people.length : 0;
  const show = (t: Tab) => tab === 'all' || tab === t;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <form onSubmit={submit} role="search" className="relative">
        <Search size={18} className="pointer-events-none absolute right-4 top-3.5 text-mute" />
        <input autoFocus className="input !py-3 !pr-11 text-base" value={input} onChange={(e) => setInput(e.target.value)} placeholder="ابحث في المنشورات والأسئلة والأشخاص…" aria-label="بحث" />
      </form>
      {q.length < 2 ? (
        <EmptyState icon={<Search />} title="ابدأ البحث" hint="اكتب كلمتين أو أكثر من حرفين، مثل: نهاية الخدمة، الإجازات، نطاقات." />
      ) : (
        <>
          <nav className="flex gap-1 rounded-xl border border-line bg-surface p-1" aria-label="نوع النتائج">
            {TABS.map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} aria-current={tab === k ? 'page' : undefined}
                className={clsx('flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition', tab === k ? 'bg-brand-600 text-white dark:text-[#06120d]' : 'text-mute hover:bg-brand-50')}>
                {label}{data && k !== 'all' ? ` (${k === 'posts' ? data.posts.length : k === 'threads' ? data.threads.length : data.people.length})` : ''}
              </button>
            ))}
          </nav>
          {!data && <><CardSkeleton /><CardSkeleton /></>}
          {data && total === 0 && <EmptyState icon={<Search />} title={`لا نتائج لـ «${q}»`} hint="جرّب كلمات أخرى أو أقل تحديداً." />}
          {data && show('threads') && data.threads.length > 0 && <section className="space-y-3"><h2 className="font-bold">الأسئلة</h2>{data.threads.map((t) => <ThreadCard key={t.id} t={t} />)}</section>}
          {data && show('posts') && data.posts.length > 0 && <section className="space-y-3"><h2 className="font-bold">المنشورات</h2>{data.posts.map((p) => <PostCard key={p.id} post={p} />)}</section>}
          {data && show('people') && data.people.length > 0 && (
            <section className="space-y-3"><h2 className="font-bold">الأشخاص</h2>
              <ul className="grid gap-3 sm:grid-cols-2">{data.people.map((u) => (
                <li key={u.id}><Link href={`/u/${u.username}`} className="card flex items-center gap-3 p-4 transition hover:border-brand-500/40">
                  <Avatar name={u.displayName} seed={u.username} size={44} />
                  <span className="min-w-0 flex-1"><b className="block truncate">{u.displayName}</b><span className="block truncate text-xs text-mute">{u.headline ?? ROLE_LABEL[u.role]}</span></span>
                  <ExpertBadge author={u} /></Link></li>))}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return <Suspense><Results /></Suspense>;
}
