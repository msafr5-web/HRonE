import type { Prisma } from '@prisma/client';

/** Public author card – never includes email or hashes. */
export const AUTHOR_SELECT = {
  id: true,
  username: true,
  displayName: true,
  headline: true,
  role: true,
  verification: true,
} satisfies Prisma.UserSelect;

export const TAG_SELECT = { select: { tag: { select: { slug: true, label: true } } } } as const;

/** Flatten the join table: [{tag:{slug,label}}] → [{slug,label}] */
export const flatTags = (rows: { tag: { slug: string; label: string } }[]) => rows.map((r) => r.tag);
