'use client';

import { CheckCircle2, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Me } from '@/lib/types';

/** The token is redeemed with a POST from the page (not a GET link) so mail-scanner prefetches cannot consume it. */
function Inner() {
  const token = useSearchParams().get('token') ?? '';
  const { ready, user, setUser } = useAuth();
  const [state, setState] = useState<'working' | 'ok' | 'bad'>('working');
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !ready) return;
    started.current = true; // guards React StrictMode's double effect (the token is single-use)
    if (!token) return setState('bad');
    api('/auth/verify-email', { method: 'POST', body: { token }, auth: false })
      .then(async () => {
        setState('ok');
        if (user) api<Me>('/auth/me').then(setUser).catch(() => {});
      })
      .catch(() => setState('bad'));
  }, [ready, token, user, setUser]);

  return (
    <div className="card mx-auto max-w-md space-y-4 p-8 text-center">
      {state === 'working' && <><Spinner className="mx-auto" /><p className="text-sm text-mute">جارٍ تأكيد بريدك…</p></>}
      {state === 'ok' && <><CheckCircle2 className="mx-auto text-brand-600" size={36} /><h1 className="text-xl font-extrabold">تم تأكيد بريدك الإلكتروني</h1>
        <Link href="/community" className="btn-primary">متابعة إلى الساحة</Link></>}
      {state === 'bad' && <><TriangleAlert className="mx-auto text-gold-500" size={32} /><h1 className="text-xl font-extrabold">الرابط غير صالح أو منتهي</h1>
        <p className="text-sm text-mute">يمكنك طلب رابط جديد بعد تسجيل الدخول، من الشريط الظاهر أعلى الصفحة.</p><Link href="/login" className="btn-primary">تسجيل الدخول</Link></>}
    </div>
  );
}

export default function VerifyEmailPage() {
  return <Suspense><Inner /></Suspense>;
}
