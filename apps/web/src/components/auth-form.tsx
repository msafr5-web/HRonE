'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth';
import { Spinner } from './ui';

function Inner({ mode }: { mode: 'login' | 'register' }) {
  const { user, ready, login, register } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get('next') ?? '/community';
  const [f, setF] = useState({ identifier: '', username: '', email: '', displayName: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  useEffect(() => { if (ready && user) router.replace(next.startsWith('/') ? next : '/community'); }, [ready, user, router, next]);

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      if (mode === 'login') await login(f.identifier, f.password);
      else await register({ username: f.username, email: f.email, password: f.password, displayName: f.displayName });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const isLogin = mode === 'login';
  return (
    <div className="mx-auto grid max-w-4xl items-stretch gap-0 overflow-hidden rounded-3xl border border-line bg-surface shadow-card md:grid-cols-2">
      <div className="brand-panel hidden flex-col justify-between p-10 md:flex">
        <div><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-base font-black">HR</span>
          <h2 className="mt-8 text-2xl font-extrabold leading-snug">مجتمع الموارد البشرية<br />الذي يفهم السوق السعودي</h2></div>
        <ul className="space-y-3 text-sm opacity-90"><li>✓ نقاشات مهنية حول نظام العمل والتأمينات</li><li>✓ أسئلة وأجوبة مع خبراء موثّقين</li><li>✓ رسائل مباشرة مع المختصين</li></ul>
      </div>
      <form onSubmit={submit} className="space-y-4 p-7 sm:p-10" noValidate>
        <h1 className="text-2xl font-extrabold">{isLogin ? 'مرحباً بعودتك' : 'أنشئ حسابك'}</h1>
        <p className="text-sm text-mute">{isLogin ? 'سجّل الدخول لمتابعة النقاش.' : 'مجاني، ويستغرق أقل من دقيقة.'}</p>
        {err && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{err}</div>}
        {isLogin ? (
          <Field label="البريد أو اسم المستخدم"><input className="input" dir="ltr" autoComplete="username" required value={f.identifier} onChange={set('identifier')} /></Field>
        ) : (
          <>
            <Field label="الاسم الظاهر"><input className="input" autoComplete="name" required minLength={2} maxLength={50} value={f.displayName} onChange={set('displayName')} /></Field>
            <Field label="اسم المستخدم" hint="3–20 حرفاً إنجليزياً أو أرقاماً أو _"><input className="input" dir="ltr" autoComplete="username" required pattern="[A-Za-z][A-Za-z0-9_]{2,19}" value={f.username} onChange={set('username')} /></Field>
            <Field label="البريد الإلكتروني"><input className="input" dir="ltr" type="email" autoComplete="email" required value={f.email} onChange={set('email')} /></Field>
          </>
        )}
        <Field label="كلمة المرور" hint={isLogin ? undefined : '10 أحرف على الأقل، وتحتوي حرفاً ورقماً'}>
          <input className="input" dir="ltr" type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} required minLength={isLogin ? 1 : 10} value={f.password} onChange={set('password')} />
        </Field>
        {isLogin && <p className="-mt-2 text-start text-sm"><Link href="/forgot-password" className="font-semibold text-brand-600 hover:underline">نسيت كلمة المرور؟</Link></p>}
        <button className="btn-primary w-full !py-3" disabled={busy}>{busy ? <Spinner /> : isLogin ? 'تسجيل الدخول' : 'إنشاء الحساب'}</button>
        {!isLogin && <p className="text-xs leading-6 text-mute">بإنشاء الحساب فأنت توافق على <Link className="underline" href="/legal/terms">الشروط</Link> و<Link className="underline" href="/legal/privacy">سياسة الخصوصية</Link>.</p>}
        <p className="text-center text-sm text-mute">{isLogin ? 'ليس لديك حساب؟' : 'لديك حساب؟'} <Link href={isLogin ? '/register' : '/login'} className="font-semibold text-brand-600 hover:underline">{isLogin ? 'انضم الآن' : 'سجّل الدخول'}</Link></p>
      </form>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-sm font-semibold">{label}</span>{children}{hint && <span className="block text-xs text-mute">{hint}</span>}</label>;
}

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  return <Suspense><Inner mode={mode} /></Suspense>;
}
