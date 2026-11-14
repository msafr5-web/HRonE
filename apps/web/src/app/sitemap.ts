import type { MetadataRoute } from 'next';
import { serverGet } from '@/lib/api';
import type { Page, Post, Thread } from '@/lib/types';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, threads] = await Promise.all([
    serverGet<Page<Post>>('/community/posts?limit=50'),
    serverGet<Page<Thread>>('/consultations?limit=50'),
  ]);
  const now = new Date();
  return [
    { url: `${SITE}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE}/community`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE}/consultations`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    ...(posts?.items ?? []).map((p) => ({ url: `${SITE}/community/${p.id}`, lastModified: new Date(p.createdAt), changeFrequency: 'weekly' as const, priority: 0.6 })),
    // premium threads are listed by title only, so they are safe to index; locked bodies are never exposed
    ...(threads?.items ?? []).map((t) => ({ url: `${SITE}/consultations/${t.id}`, lastModified: new Date(t.createdAt), changeFrequency: 'weekly' as const, priority: 0.7 })),
  ];
}
