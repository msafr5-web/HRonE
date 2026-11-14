'use client';

import { CheckCircle2, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { Spinner } from '@/components/ui';
import { api } from '@/lib/api';

function Inner() {
  const token = useSearchParams().get('token') ?? '';
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const valid = pw.length >= 10 && /[A-Za-z؀-ۿ]/.test(pw) && /\d/.test(pw) && pw === pw2;

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api('/auth/reset-password', { method: 'POST', body: { token, password: pw }, auth: false }); setDone(true); }
    catch (e) { setErr((e as Error).message === 'تعذّر تنفيذ الطلب' ? 'الرابط غير صالح أو منتهي. اطلب رابطاً جديداً.' : (e as Error).message); }
    finally { setBusy(false); }
  }

  if (!token) return (
    <div className="card mx-auto max-w-md space-y-3 p-8 text-center"><TriangleAlert className="mx-auto text-gold-500" /><h1 className="text-xl font-extrabold">رابط غير مكتمل</h1>
      <p className="text-sm text-mute">افتح الرابط كما وصلك في البريد، أو اطلب رابطاً جديداً.</p><Link href="/forgot-password" className="btn-primary">طلب رابط جديد</Link></div>
  );
  if (done) return (
    <div className="card mx-auto max-w-md space-y-4 p-8 text-center"><CheckCircle2 className="mx-auto text-brand-600" size={36} /><h1 className="text-xl font-extrabold">تم تغيير كلمة المرور</h1>
      <p className="text-sm text-mute">سُجِّل خروجك من جميع الأجهزة لأمانك. سجّل الدخول بكلمة المرور الجديدة.</p><Link href="/login" className="btn-primary">تسجيل الدخول</Link></div>
  );
  return (
    <form onSubmit={submit} className="card mx-auto max-w-md space-y-4 p-8" noValidate>
      <h1 className="text-2xl font-extrabold">كلمة مرور جديدة</h1>
      {err && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{err} {err.includes('منتهي') && <Link href="/forgot-password" className="font-semibold underline">رابط جديد</Link>}</div>}
      <label className="block space-y-1.5"><span className="text-sm font-semibold">كلمة المرور الجديدة</span>
        <input className="input" dir="ltr" type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
        <span className="block text-xs text-mute">10 أحرف على الأقل، وتحتوي حرفاً ورقماً</span></label>
      <label className="block space-y-1.5"><span className="text-sm font-semibold">تأكيد كلمة المرور</span>
        <input className="input" dir="ltr" type="password" autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
        {pw2 && pw !== pw2 && <span className="block text-xs text-red-600">كلمتا المرور غير متطابقتين</span>}</label>
      <button className="btn-primary w-full !py-3" disabled={busy || !valid}>{busy ? <Spinner /> : 'حفظ كلمة المرور'}</button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><Inner /></Suspense>;
}
