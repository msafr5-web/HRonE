import { ArrowLeft, BadgeCheck, Mail, MessagesSquare, Users } from 'lucide-react';
import Link from 'next/link';
import { Aside } from '@/components/aside';
import { PostCard } from '@/components/post-card';
import { EmptyState } from '@/components/ui';
import { ThreadCard } from '@/components/thread-card';
import { serverGet } from '@/lib/api';
import type { Page, Post, Tag, Thread } from '@/lib/types';

const FEATURES = [
  { icon: Users, title: 'ساحة مهنية', text: 'منشورات ونقاشات يومية حول الموارد البشرية في السوق السعودي، مع وسوم تسهّل الوصول.' },
  { icon: MessagesSquare, title: 'أسئلة وأجوبة', text: 'اطرح مشكلتك، واستقبل إجابات مرتّبة بالتصويت، واعتمد أفضلها ليستفيد غيرك.' },
  { icon: BadgeCheck, title: 'خبراء موثّقون', text: 'تُراجَع إثباتات الخبراء يدوياً، وتظهر شارة التوثيق على إجاباتهم.' },
  { icon: Mail, title: 'رسائل مباشرة', text: 'تواصل خاص وفوري مع الزملاء والخبراء داخل المنصة.' },
];

const STATS = [
  { q: 'نظام العمل', icon: 'bi-journal-text' },
  { q: 'التأمينات الاجتماعية', icon: 'bi-shield-check' },
  { q: 'نطاقات', icon: 'bi-graph-up-arrow' },
];

export default async function Home() {
  const [posts, threads, trending] = await Promise.all([
    serverGet<Page<Post>>('/community/posts?limit=3'),
    serverGet<Page<Thread>>('/consultations?limit=3'),
    serverGet<(Tag & { count: number })[]>('/community/tags/trending'),
  ]);
  return (
    <div className="space-y-14">
      <section className="brand-panel relative overflow-hidden rounded-3xl px-6 py-14 sm:px-12 sm:py-20">
        <div aria-hidden className="hero-grid" />
        <div aria-hidden className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-gold-500/25 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 right-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative max-w-2xl">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">مجتمع الموارد البشرية في المملكة العربية السعودية</span>
          <h1 className="mt-5 text-3xl font-black leading-[1.35] sm:text-5xl">اسأل. شارك. تعلّم<br />من أهل المهنة.</h1>
          <p className="mt-5 text-base leading-8 opacity-90 sm:text-lg">منصة تجمع أخصائيي وموظفي الموارد البشرية لمناقشة نظام العمل والتأمينات ونطاقات، مع خبراء موثّقين وإجابات يعتمدها المجتمع.</p>
          <ul className="mt-6 flex flex-wrap gap-2" aria-label="مواضيع رئيسية">
            {STATS.map((s) => <li key={s.q}><Link href={`/search?q=${encodeURIComponent(s.q)}`} className="hero-stat"><i className={`bi ${s.icon}`} aria-hidden /> {s.q}</Link></li>)}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#0b3d2e] shadow-lg transition hover:-translate-y-0.5">انضم مجاناً <ArrowLeft size={16} /></Link>
            <Link href="/community" className="inline-flex items-center rounded-xl border border-white/40 px-6 py-3 text-sm font-semibold backdrop-blur transition hover:bg-white/10">تصفّح الساحة</Link>
          </div>
        </div>
      </section>

      <section aria-label="المزايا" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: I, title, text }, i) => (
          <div key={title} className="card animate-rise p-5" style={{ animationDelay: `${i * 70}ms` }}>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><I size={22} /></span>
            <h2 className="mt-4 font-bold">{title}</h2><p className="mt-1.5 text-sm leading-7 text-mute">{text}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-12">
          <section>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-extrabold">أحدث الأسئلة</h2><Link href="/consultations" className="text-sm font-semibold text-brand-600 hover:underline">عرض الكل</Link></div>
            <div className="space-y-4">{threads?.items.length ? threads.items.map((t) => <ThreadCard key={t.id} t={t} />) : <EmptyState icon={<MessagesSquare size={26} />} title="لا توجد أسئلة بعد" hint="ابدأ النقاش بسؤال واضح عن نظام العمل أو التأمينات أو نطاقات، وسيجيبك أهل المهنة." action={<Link className="btn-primary" href="/consultations/new">اطرح أول سؤال</Link>} />}</div>
          </section>
          <section>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-extrabold">من الساحة</h2><Link href="/community" className="text-sm font-semibold text-brand-600 hover:underline">عرض الكل</Link></div>
            <div className="space-y-4">{posts?.items.length ? posts.items.map((p) => <PostCard key={p.id} post={p} />) : <EmptyState icon={<Users size={26} />} title="لا توجد منشورات بعد" hint="شارك خبرة أو تجربة مهنية لتكون أول من يضيء الساحة." action={<Link className="btn-primary" href="/community">اذهب إلى الساحة</Link>} />}</div>
          </section>
        </div>
        <Aside trending={trending ?? []} />
      </div>
    </div>
  );
}
