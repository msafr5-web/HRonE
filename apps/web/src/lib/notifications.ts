import type { Author } from './types';

export type NotificationType =
  | 'POST_LIKE' | 'POST_COMMENT' | 'THREAD_REPLY' | 'REPLY_REPLY'
  | 'ANSWER_ACCEPTED' | 'NEW_FOLLOWER' | 'VERIFICATION_APPROVED' | 'VERIFICATION_REJECTED';

export interface Notification {
  id: string;
  type: NotificationType;
  targetType: 'POST' | 'THREAD' | 'USER' | null;
  targetId: string | null;
  preview: string | null;
  readAt: string | null;
  createdAt: string;
  actor: Author | null;
}

export function notificationText(n: Notification): string {
  const who = n.actor?.displayName ?? 'الإدارة';
  switch (n.type) {
    case 'POST_LIKE': return `${who} أعجب بمنشورك`;
    case 'POST_COMMENT': return `${who} علّق على منشورك`;
    case 'THREAD_REPLY': return `${who} أجاب على سؤالك`;
    case 'REPLY_REPLY': return `${who} ردّ على إجابتك`;
    case 'ANSWER_ACCEPTED': return `${who} اعتمد إجابتك 🎉`;
    case 'NEW_FOLLOWER': return `${who} بدأ بمتابعتك`;
    case 'VERIFICATION_APPROVED': return 'تم قبول طلب توثيقك كخبير';
    case 'VERIFICATION_REJECTED': return 'لم يُقبل طلب التوثيق';
  }
}

export function notificationHref(n: Notification): string {
  if (n.type === 'NEW_FOLLOWER' && n.actor) return `/u/${n.actor.username}`;
  if (n.type === 'VERIFICATION_APPROVED' || n.type === 'VERIFICATION_REJECTED') return '/settings';
  if (n.targetType === 'POST' && n.targetId) return `/community/${n.targetId}`;
  if (n.targetType === 'THREAD' && n.targetId) return `/consultations/${n.targetId}`;
  return '/notifications';
}
