import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/messages', '/settings', '/admin', '/reset-password', '/verify-email', '/notifications', '/search'] }] };
}
