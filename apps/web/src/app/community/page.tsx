import type { Metadata } from 'next';
import { Aside } from '@/components/aside';
import { PostFeed } from '@/components/post-feed';
import { serverGet } from '@/lib/api';
import type { Page, Post, Tag } from '@/lib/types';

export const metadata: Metadata = { title: 'الساحة العامة', description: 'نقاشات ومنشورات مهنية حول الموارد البشرية ونظام العمل في السعودية.' };

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ tag?: string }> }) {
  const { tag } = await searchParams;
  const [posts, trending] = await Promise.all([
    serverGet<Page<Post>>(`/community/posts?limit=15${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`),
    serverGet<(Tag & { count: number })[]>('/community/tags/trending'),
  ]);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <h1 className="mb-4 text-2xl font-extrabold">الساحة العامة</h1>
        <PostFeed initial={posts} tag={tag} suggestions={trending ?? []} />
      </div>
      <Aside trending={trending ?? []} />
    </div>
  );
}
