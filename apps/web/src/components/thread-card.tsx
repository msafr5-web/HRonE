import { CheckCircle2, Lock, MessageCircle, UserX } from 'lucide-react';
import Link from 'next/link';
import { CATEGORY_LABEL, categoryOf } from '@/lib/categories';
import { timeAgo } from '@/lib/format';
import type { Thread } from '@/lib/types';
import { CopyLinkButton } from './copy-link-button';
import { Avatar, ExpertBadge, TagChips } from './ui';

export function ThreadCard({ t }: { t: Thread }) {
  const cat = categoryOf(t.tags);
  return (
    <article className={`card card-lift cat-border cat-${cat} animate-rise p-5`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="cat-label">{CATEGORY_LABEL[cat]}</span>
        {t.solved && <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 font-semibold text-brand-700"><CheckCircle2 size={13} /> تمت الإجابة</span>}
        {!t.solved && t.replyCount === 0 && <span className="rounded-full bg-gold-500/15 px-2 py-0.5 font-semibold text-gold-600">بانتظار إجابة</span>}
        {t.isPremium && <span className="inline-flex items-center gap-1 rounded-full bg-ink/10 px-2 py-0.5 font-semibold"><Lock size={12} /> مميّز</span>}
      </div>
      <Link href={`/consultations/${t.id}`} className="mt-2 block">
        <h3 className="text-lg font-bold leading-snug hover:text-brand-600">{t.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-7 text-mute">{t.body}</p>
      </Link>
      {t.tags.length > 0 && <div className="mt-3"><TagChips tags={t.tags} /></div>}
      <footer className="mt-4 flex items-center gap-3 text-xs text-mute">
        {t.author ? (
          <Link href={`/u/${t.author.username}`} className="flex items-center gap-2 hover:text-ink"><Avatar name={t.author.displayName} seed={t.author.username} size={24} />{t.author.displayName}<ExpertBadge author={t.author} /></Link>
        ) : (
          <span className="flex items-center gap-2"><UserX size={16} /> عضو مجهول</span>
        )}
        <span>·</span><time dateTime={t.createdAt}>{timeAgo(t.createdAt)}</time>
        <span className="ms-auto inline-flex items-center gap-1"><MessageCircle size={14} /> {t.replyCount} {t.replyCount === 1 ? 'رد' : 'ردود'}</span>
        <CopyLinkButton path={`/consultations/${t.id}`} />
      </footer>
    </article>
  );
}
