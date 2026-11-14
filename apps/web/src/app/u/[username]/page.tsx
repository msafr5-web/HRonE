import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PostFeed } from '@/components/post-feed';
import { ProfileActions } from '@/components/follow-button';
import { Avatar, ExpertBadge } from '@/components/ui';
import { serverGet } from '@/lib/api';
import { dateAr, ROLE_LABEL } from '@/lib/format';
import type { Page, Post, Profile } from '@/lib/types';

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const p = await serverGet<Profile>(`/users/${username}`);
  return p ? { title: `${p.displayName} (@${p.username})`, description: p.headline ?? p.bio ?? undefined } : { title: 'مستخدم غير موجود' };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const [p, posts] = await Promise.all([
    serverGet<Profile>(`/users/${username}`),
    serverGet<Page<Post>>(`/community/posts?limit=15&author=${encodeURIComponent(username)}`),
  ]);
  if (!p) notFound();
  const stat = (n: number, l: string) => <div className="text-center"><b className="block text-lg">{n}</b><span className="text-xs text-mute">{l}</span></div>;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="card overflow-hidden">
        <div className="brand-panel h-24" />
        <div className="px-6 pb-6">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-3">
            <span className="rounded-full ring-4 ring-surface"><Avatar name={p.displayName} seed={p.username} size={84} /></span>
            <ProfileActions profile={p} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2"><h1 className="text-2xl font-extrabold">{p.displayName}</h1><ExpertBadge author={p} full /></div>
          <p className="text-sm text-mute" dir="ltr" style={{ textAlign: 'right' }}>@{p.username}</p>
          {p.headline && <p className="mt-2 text-sm font-medium">{p.headline}</p>}
          {p.bio && <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-mute">{p.bio}</p>}
          <p className="mt-3 text-xs text-mute">{ROLE_LABEL[p.role]} · انضم في {dateAr(p.createdAt)}</p>
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4">{stat(p.postCount, 'منشور')}{stat(p.followerCount, 'متابع')}{stat(p.followingCount, 'يتابع')}</div>
        </div>
      </section>
      <h2 className="text-lg font-bold">المنشورات</h2>
      <PostFeed initial={posts} author={p.username} suggestions={[]} showComposer={false} />
    </div>
  );
}
