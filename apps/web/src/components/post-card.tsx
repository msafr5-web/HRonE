'use client';

import clsx from 'clsx';
import { Heart, MessageCircle, Share2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { compact, timeAgo } from '@/lib/format';
import type { Post } from '@/lib/types';
import { ReportButton } from './report-button';
import { RichText } from './rich-text';
import { Avatar, ExpertBadge, TagChips, useToast } from './ui';

export function PostCard({ post, full, onRemoved }: { post: Post; full?: boolean; onRemoved?: (id: string) => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [liked, setLiked] = useState(post.viewerLiked);
  const [count, setCount] = useState(post.likeCount);
  const [pop, setPop] = useState(false);
  const a = post.author;

  // Server-rendered cards don't know the viewer; sync once the session is known.
  useEffect(() => { setLiked(post.viewerLiked); setCount(post.likeCount); }, [post.viewerLiked, post.likeCount]);

  async function toggleLike() {
    if (!user) return router.push('/login');
    const next = !liked;
    setLiked(next); setCount((c) => c + (next ? 1 : -1)); setPop(true); setTimeout(() => setPop(false), 300);
    try {
      const r = await api<{ likeCount: number }>(`/community/posts/${post.id}/like`, { method: next ? 'POST' : 'DELETE' });
      setCount(r.likeCount);
    } catch (e) {
      setLiked(!next); setCount((c) => c + (next ? -1 : 1));
      toast((e as Error).message, 'err');
    }
  }

  async function share() {
    const url = `${location.origin}/community/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ url, text: post.body.slice(0, 80) });
      else { await navigator.clipboard.writeText(url); toast('تم نسخ الرابط'); }
    } catch {}
  }

  async function remove() {
    if (!confirm('هل تريد حذف هذا المنشور؟')) return;
    try {
      await api(`/community/posts/${post.id}`, { method: 'DELETE' });
      toast('تم الحذف');
      onRemoved ? onRemoved(post.id) : router.push('/community');
    } catch (e) { toast((e as Error).message, 'err'); }
  }

  const canDelete = user && (user.id === a.id || user.role === 'ADMIN');
  return (
    <article className="card card-lift animate-rise p-5">
      <header className="flex items-start gap-3">
        <Link href={`/u/${a.username}`}><Avatar name={a.displayName} seed={a.username} /></Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Link href={`/u/${a.username}`} className="font-bold hover:text-brand-600">{a.displayName}</Link>
            <ExpertBadge author={a} />
          </div>
          <p className="truncate text-xs text-mute">{a.headline ? `${a.headline} · ` : ''}<time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time></p>
        </div>
        {canDelete && <button className="btn-ghost !p-2" aria-label="حذف المنشور" onClick={remove}><Trash2 size={16} /></button>}
      </header>

      <div className="mt-3">
        {full ? (
          <p className="whitespace-pre-wrap break-words text-[15px] leading-8"><RichText text={post.body} /></p>
        ) : (
          <Link href={`/community/${post.id}`} className="block">
            <p className="line-clamp-6 whitespace-pre-wrap break-words text-[15px] leading-8">{post.body}</p>
          </Link>
        )}
      </div>
      {post.tags.length > 0 && <div className="mt-3"><TagChips tags={post.tags} /></div>}

      <footer className="mt-4 flex items-center gap-1 border-t border-line pt-3 text-mute">
        <button onClick={toggleLike} aria-pressed={liked} aria-label="إعجاب" className={clsx('btn-ghost !px-3', liked && '!text-rose-500')}>
          <Heart size={18} className={clsx(pop && 'animate-pop')} fill={liked ? 'currentColor' : 'none'} /> {count > 0 && <span className="text-sm">{compact(count)}</span>}
        </button>
        <Link href={`/community/${post.id}#comments`} className="btn-ghost !px-3" aria-label="التعليقات">
          <MessageCircle size={18} /> {post.commentCount > 0 && <span className="text-sm">{compact(post.commentCount)}</span>}
        </Link>
        <button onClick={share} className="btn-ghost !px-3" aria-label="مشاركة"><Share2 size={17} /></button>
        <span className="ms-auto"><ReportButton type="POST" id={post.id} /></span>
      </footer>
    </article>
  );
}
