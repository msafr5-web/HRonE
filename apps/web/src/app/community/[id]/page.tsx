import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Comments } from '@/components/comments';
import { PostCard } from '@/components/post-card';
import { serverGet } from '@/lib/api';
import type { Post } from '@/lib/types';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await serverGet<Post>(`/community/posts/${id}`);
  if (!post) return { title: 'منشور غير موجود' };
  const text = post.body.replace(/\s+/g, ' ').slice(0, 150);
  return { title: `${post.author.displayName}: ${text.slice(0, 50)}`, description: text, openGraph: { type: 'article', description: text } };
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const post = await serverGet<Post>(`/community/posts/${id}`);
  if (!post) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/community" className="mb-4 inline-flex items-center gap-1 text-sm text-mute hover:text-ink"><ArrowRight size={16} /> العودة إلى الساحة</Link>
      <PostCard post={post} full />
      <Comments postId={id} />
    </div>
  );
}
