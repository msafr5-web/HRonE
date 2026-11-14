import { PenSquare } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import clsx from 'clsx';
import { Aside } from '@/components/aside';
import { ThreadFeed } from '@/components/thread-feed';
import { Disclaimer } from '@/components/ui';
import { serverGet } from '@/lib/api';
import type { Page, Tag, Thread } from '@/lib/types';

export const metadata: Metadata = { title: 'الاستشارات المجتمعية', description: 'اطرح مشكلتك المهنية واحصل على إجابات من زملاء وخبراء موثّقين في الموارد البشرية.' };

const FILTERS = [['all', 'الكل'], ['unanswered', 'بانتظار إجابة'], ['solved', 'تمت الإجابة']] as const;

export default async function ConsultationsPage({ searchParams }: { searchParams: Promise<{ filter?: string; tag?: string }> }) {
  const sp = await searchParams;
  const filter = FILTERS.some(([k]) => k === sp.filter) ? sp.filter! : 'all';
  const [threads, trending] = await Promise.all([
    serverGet<Page<Thread>>(`/consultations?limit=15&filter=${filter}${sp.tag ? `&tag=${encodeURIComponent(sp.tag)}` : ''}`),
    serverGet<(Tag & { count: number })[]>('/community/tags/trending'),
  ]);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold">الاستشارات المجتمعية</h1>
          <Link href="/consultations/new" className="btn-primary"><PenSquare size={16} /> اطرح سؤالاً</Link>
        </div>
        <Disclaimer />
        <nav aria-label="تصفية الأسئلة" className="flex gap-1 rounded-xl border border-line bg-surface p-1">
          {FILTERS.map(([k, label]) => (
            <Link key={k} href={`/consultations?filter=${k}`} aria-current={filter === k ? 'page' : undefined}
              className={clsx('flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold transition', filter === k ? 'bg-brand-600 text-white dark:text-[#06120d]' : 'text-mute hover:bg-brand-50')}>{label}</Link>
          ))}
        </nav>
        <ThreadFeed key={`${filter}-${sp.tag}`} initial={threads} filter={filter} tag={sp.tag} />
      </div>
      <Aside trending={trending ?? []} />
    </div>
  );
}
