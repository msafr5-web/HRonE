'use client';

import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Spinner } from '@/components/ui';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api('/auth/forgot-password', { method: 'POST', body: { email }, auth: false }); setDone(true); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="card mx-auto max-w-md p-8">
      {done ? (
        <div className="space-y-4 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><MailCheck /></span>
          <h1 className="text-xl font-extrabold">تحقق من بريدك</h1>
          <p className="text-sm leading-7 text-mute">إن كان البريد <b dir="ltr">{email}</b> مسجّلاً لدينا فقد أرسلنا إليه رابطاً لإعادة تعيين كلمة المرور. الرابط صالح لمدة ساعة ويُستخدم مرة واحدة.</p>
          <p className="text-xs text-mute">لم تصلك الرسالة؟ راجع مجلد الرسائل غير المرغوبة.</p>
          <Link href="/login" className="btn-outline">العودة لتسجيل الدخول</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <h1 className="text-2xl font-extrabold">نسيت كلمة المرور؟</h1>
          <p className="text-sm text-mute">أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين.</p>
          {err && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
          <label className="block space-y-1.5"><span className="text-sm font-semibold">البريد الإلكتروني</span>
            <input className="input" dir="ltr" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <button className="btn-primary w-full !py-3" disabled={busy || !email.includes('@')}>{busy ? <Spinner /> : 'إرسال الرابط'}</button>
          <p className="text-center text-sm"><Link href="/login" className="font-semibold text-brand-600 hover:underline">العودة لتسجيل الدخول</Link></p>
        </form>
      )}
    </div>
  );
}
