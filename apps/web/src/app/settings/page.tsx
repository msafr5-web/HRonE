'use client';

import { BadgeCheck, Clock3, Crown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Spinner, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateAr, isExpert, ROLE_LABEL } from '@/lib/format';
import type { Me } from '@/lib/types';

interface Sub { id: string; interval: 'MONTH' | 'YEAR'; status: string; currentPeriodEnd: string }

export default function SettingsPage() {
  const { user, ready, setUser } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [p, setP] = useState({ displayName: '', headline: '', bio: '' });
  const [v, setV] = useState({ requestedRole: 'HR_SPECIALIST', notes: '', doc: '' });
  const [subs, setSubs] = useState<Sub[]>([]);
  const [busy, setBusy] = useState<'' | 'profile' | 'verify'>('');

  useEffect(() => { if (ready && !user) router.replace('/login?next=/settings'); }, [ready, user, router]);
  useEffect(() => {
    if (!user) return;
    setP({ displayName: user.displayName, headline: user.headline ?? '', bio: user.bio ?? '' });
    api<Sub[]>('/subscriptions/me').then(setSubs).catch(() => {});
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!user) return <Spinner className="mx-auto mt-20" />;

  async function saveProfile() {
    setBusy('profile');
    try { setUser(await api<Me>('/users/me', { method: 'PATCH', body: p })); toast('تم حفظ الملف الشخصي'); } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(''); }
  }
  async function requestVerification() {
    setBusy('verify');
    try {
      await api('/users/me/verification', { method: 'POST', body: { requestedRole: v.requestedRole, notes: v.notes || undefined, documents: v.doc ? [v.doc] : undefined } });
      setUser({ ...user!, verification: 'PENDING' }); toast('أُرسل طلب التوثيق وسيُراجع قريباً');
    } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(''); }
  }

  const active = subs.find((s) => s.status === 'ACTIVE' && new Date(s.currentPeriodEnd) > new Date());
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-extrabold">الإعدادات</h1>

      <section className="card space-y-4 p-6">
        <h2 className="font-bold">الملف الشخصي</h2>
        <label className="block space-y-1.5"><span className="text-sm font-semibold">الاسم الظاهر</span><input className="input" maxLength={50} value={p.displayName} onChange={(e) => setP({ ...p, displayName: e.target.value })} /></label>
        <label className="block space-y-1.5"><span className="text-sm font-semibold">المسمى المهني</span><input className="input" maxLength={100} value={p.headline} placeholder="مثال: مدير موارد بشرية – الرياض" onChange={(e) => setP({ ...p, headline: e.target.value })} /></label>
        <label className="block space-y-1.5"><span className="text-sm font-semibold">نبذة</span><textarea className="input min-h-[100px]" maxLength={500} value={p.bio} onChange={(e) => setP({ ...p, bio: e.target.value })} /></label>
        <div className="flex justify-end"><button className="btn-primary" onClick={saveProfile} disabled={busy === 'profile' || p.displayName.trim().length < 2}>{busy === 'profile' ? <Spinner /> : 'حفظ'}</button></div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="flex items-center gap-2 font-bold"><BadgeCheck size={18} className="text-gold-500" /> توثيق الخبراء</h2>
        {isExpert(user) ? (
          <p className="rounded-xl bg-brand-50 p-4 text-sm text-brand-700">حسابك موثّق كـ <b>{ROLE_LABEL[user.role]}</b>. تظهر شارة «خبير موثّق» على إجاباتك.</p>
        ) : user.verification === 'PENDING' ? (
          <p className="flex items-center gap-2 rounded-xl bg-gold-500/10 p-4 text-sm"><Clock3 size={16} /> طلبك قيد المراجعة من فريق HRonE.</p>
        ) : (
          <>
            {user.verification === 'REJECTED' && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">لم يُقبل طلبك السابق. يمكنك إعادة التقديم مع مستندات أوضح.</p>}
            <p className="text-sm leading-7 text-mute">يُراجع الطلب يدوياً. أرفق رابطاً لإثبات مهني (ملفك على LinkedIn، ترخيص مهني، أو جهة عمل). الأدوار الخاصة لا تُمنح تلقائياً.</p>
            <label className="block space-y-1.5"><span className="text-sm font-semibold">الصفة المطلوبة</span>
              <select className="input" value={v.requestedRole} onChange={(e) => setV({ ...v, requestedRole: e.target.value })}><option value="HR_SPECIALIST">أخصائي موارد بشرية</option><option value="LEGAL_CONSULTANT">مستشار قانوني</option></select></label>
            <label className="block space-y-1.5"><span className="text-sm font-semibold">رابط إثبات (https)</span><input className="input" dir="ltr" placeholder="https://…" value={v.doc} onChange={(e) => setV({ ...v, doc: e.target.value })} /></label>
            <label className="block space-y-1.5"><span className="text-sm font-semibold">ملاحظات</span><textarea className="input min-h-[80px]" maxLength={1000} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></label>
            <div className="flex justify-end"><button className="btn-primary" onClick={requestVerification} disabled={busy === 'verify'}>{busy === 'verify' ? <Spinner /> : 'إرسال الطلب'}</button></div>
          </>
        )}
      </section>

      <section className="card space-y-2 p-6">
        <h2 className="flex items-center gap-2 font-bold"><Crown size={18} className="text-gold-500" /> الاشتراك</h2>
        {active ? <p className="text-sm">اشتراك فعّال حتى <b>{dateAr(active.currentPeriodEnd)}</b>.</p> : <p className="text-sm text-mute">لا يوجد اشتراك فعّال. الباقات المميّزة قيد التفعيل وسنعلن عنها قريباً.</p>}
      </section>
    </div>
  );
}
