import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ThreadView } from '@/components/thread-view';
import { serverGet } from '@/lib/api';
import type { Thread } from '@/lib/types';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = await serverGet<Thread>(`/consultations/${id}`);
  if (!t) return { title: 'سؤال غير موجود' };
  return { title: t.title, description: t.body.replace(/\s+/g, ' ').slice(0, 150) };
}

export default async function ThreadPage({ params }: Props) {
  const { id } = await params;
  const thread = await serverGet<Thread>(`/consultations/${id}`);
  if (!thread) notFound();
  return (
    <>
      <Link href="/consultations" className="mx-auto mb-4 flex max-w-3xl items-center gap-1 text-sm text-mute hover:text-ink"><ArrowRight size={16} /> كل الاستشارات</Link>
      <ThreadView initial={thread} />
    </>
  );
}
