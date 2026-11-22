'use client';

import { EyeOff, Hash, Lock, ShieldAlert, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CharCounter } from '@/components/char-counter';
import { Disclaimer, Spinner, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { isExpert } from '@/lib/format';
import type { Thread } from '@/lib/types';
import { useDraft } from '@/lib/use-draft';

export default function NewThreadPage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const toast = useToast();
  // Anonymous drafts are never persisted (privacy); everything else is auto-saved locally.
  const { value: f, setValue: setF, clear: clearDraft, restored } = useDraft('thread', { title: '', body: '', isAnonymous: false, isPremium: false }, { enabled: (v) => !v.isAnonymous });
  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { if (restored) toast('تم استرجاع مسودتك'); }, [restored]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ready && !user) router.replace('/login?next=/consultations/new'); }, [ready, user, router]);
  if (!user) return <div className="mx-auto max-w-2xl"><Spinner className="mx-auto mt-20" /></div>;

  const canPremium = user.role === 'ADMIN' || isExpert(user);
  const addTag = () => { const t = draft.replace(/^#+/, '').trim().replace(/\s+/g, '_'); if (t.length >= 2 && tags.length < 5 && !tags.includes(t)) setTags([...tags, t]); setDraft(''); };
  const valid = f.title.trim().length >= 8 && f.body.trim().length >= 20;

  async function submit() {
    setBusy(true); setErr('');
    try {
      const t = await api<Thread>('/consultations', { method: 'POST', body: { ...f, tags } });
      clearDraft();
      toast('تم نشر سؤالك');
      router.push(`/consultations/${t.id}`);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div><h1 className="text-2xl font-extrabold">اطرح سؤالاً على المجتمع</h1><p className="mt-1 text-sm text-mute">كلما كان سؤالك أوضح، كانت الإجابات أدق.</p></div>
      <Disclaimer />
      <div className="flex gap-2 rounded-xl border border-red-300/60 bg-red-50 px-4 py-3 text-xs leading-6 text-red-800 dark:bg-red-950/30 dark:text-red-200">
        <ShieldAlert size={18} className="mt-0.5 shrink-0" /> لا تذكر أسماء أشخاص أو أرقام هوية أو عقود أو بيانات تُعرّف بك. يمكنك تفعيل «النشر المجهول» لإخفاء هويتك عن العامة.
      </div>
      <div className="card space-y-5 p-6">
        {err && <div role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
        <label className="block space-y-1.5"><span className="text-sm font-semibold">عنوان السؤال</span>
          <input className="input" maxLength={160} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="مثال: كيف تُحتسب مكافأة نهاية الخدمة عند الاستقالة؟" />
          <span className="text-xs text-mute">8 أحرف على الأقل</span></label>
        <label className="block space-y-1.5"><span className="text-sm font-semibold">التفاصيل</span>
          <textarea className="input min-h-[160px] leading-7" maxLength={5000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="اشرح الموقف، المدة، وما حاولت فعله حتى الآن…" />
          </label>
        <div className="-mt-3"><CharCounter length={f.body.length} max={5000} min={20} /></div>
        <div className="space-y-2"><span className="text-sm font-semibold">الوسوم</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((t) => <span key={t} className="chip gap-1">#{t}<button aria-label={`إزالة ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))}><X size={12} /></button></span>)}
            {tags.length < 5 && <label className="flex items-center gap-1 text-sm text-mute"><Hash size={14} /><input className="w-32 bg-transparent focus:outline-none" value={draft} placeholder="اكتب وسماً ثم Enter" aria-label="إضافة وسم" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} onBlur={() => draft && addTag()} /></label>}
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 hover:bg-brand-50">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-[rgb(var(--brand-600))]" checked={f.isAnonymous} onChange={(e) => setF({ ...f, isAnonymous: e.target.checked })} />
          <span><span className="flex items-center gap-1.5 text-sm font-semibold"><EyeOff size={15} /> النشر المجهول</span><span className="text-xs text-mute">يظهر سؤالك للعامة بدون اسمك. تحتفظ المنصة بالهوية لأغراض الإشراف فقط.</span></span>
        </label>
        {canPremium && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gold-500/40 p-3 hover:bg-gold-500/5">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[rgb(var(--brand-600))]" checked={f.isPremium} onChange={(e) => setF({ ...f, isPremium: e.target.checked })} />
            <span><span className="flex items-center gap-1.5 text-sm font-semibold"><Lock size={15} /> محتوى مميّز</span><span className="text-xs text-mute">متاح للمشتركين فقط (للخبراء الموثّقين والإدارة).</span></span>
          </label>
        )}
        <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={() => router.back()}>إلغاء</button>
          <button className="btn-primary" disabled={!valid || busy} onClick={submit}>{busy ? <Spinner /> : 'نشر السؤال'}</button></div>
      </div>
    </div>
  );
}
