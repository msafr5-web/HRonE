export type Role = 'EMPLOYEE' | 'HR_SPECIALIST' | 'LEGAL_CONSULTANT' | 'ADMIN';
export type VerificationStatus = 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REVOKED';

export interface Author {
  id: string;
  username: string;
  displayName: string;
  headline: string | null;
  role: Role;
  verification: VerificationStatus;
}
export interface Me extends Author {
  bio: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
}
export interface Tag { slug: string; label: string }

export interface Post {
  id: string;
  body: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  author: Author;
  tags: Tag[];
  viewerLiked: boolean;
}
export interface Comment { id: string; body: string; createdAt: string; author: Author }

export interface Thread {
  id: string;
  title: string;
  body: string;
  isPremium: boolean;
  isAnonymous: boolean;
  locked: boolean;
  solved: boolean;
  mine: boolean;
  replyCount: number;
  acceptedReplyId: string | null;
  createdAt: string;
  author: Author | null;
  tags: Tag[];
}
export interface Reply {
  id: string;
  parentId: string | null;
  body: string;
  asExpert: boolean;
  score: number;
  accepted: boolean;
  viewerVote: -1 | 0 | 1;
  createdAt: string;
  author: Author;
}
export interface Page<T> { items: T[]; nextCursor: string | null }

export interface Conversation {
  id: string;
  peer: Author;
  lastMessage: Message | null;
  lastMessageAt: string;
  unread: number;
  blockedByMe: boolean;
}
export interface Message { id: string; conversationId: string; senderId: string; body: string; createdAt: string; clientMsgId: string }
export interface Profile extends Author {
  bio: string | null;
  createdAt: string;
  followerCount: number;
  followingCount: number;
  postCount: number;
  viewerFollows: boolean;
  viewerBlocked: boolean;
}
