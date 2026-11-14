import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import type { ReactNode } from 'react';
import { BottomNav, Footer, Header } from '@/components/shell';
import { ToastProvider } from '@/components/ui';
import { VerifyBanner } from '@/components/verify-banner';
import { AuthProvider } from '@/lib/auth';
import './globals.css';

const plex = IBM_Plex_Sans_Arabic({ subsets: ['arabic', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex', display: 'swap' });

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: 'HRonE – مجتمع الموارد البشرية في السعودية', template: '%s | HRonE' },
  description: 'مجتمع مهني لأخصائيي وموظفي الموارد البشرية في المملكة: نقاشات، أسئلة وأجوبة، وخبراء موثّقون حول نظام العمل والتأمينات ونطاقات.',
  openGraph: { type: 'website', locale: 'ar_SA', siteName: 'HRonE' },
};
export const viewport: Viewport = { themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f7f5ef' }, { media: '(prefers-color-scheme: dark)', color: '#0b120f' }] };

// Applies the saved theme before first paint (no flash).
const THEME_SCRIPT = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={plex.variable} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:right-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-white">تخطَّ إلى المحتوى</a>
        <AuthProvider>
          <ToastProvider>
            <Header />
            <VerifyBanner />
            <main id="main" className="mx-auto min-h-[70vh] max-w-6xl px-4 pt-6">{children}</main>
            <Footer />
            <BottomNav />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
