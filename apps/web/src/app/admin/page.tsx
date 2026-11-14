'use client';

import clsx from 'clsx';
import { BadgeCheck, Crown, ExternalLink, Flag, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Avatar, EmptyState, Spinner, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ROLE_LABEL, timeAgo } from '@/lib/format';
import type { Author, Role } from '@/lib/types';

interface ReportRow { id: string; targetType: string; targetId: string; reason: string; createdAt: string; reporter: Author; preview: string | null; href: string | null; authorId: string | null; authorName: string | null }
interface VerRow { id: string; requestedRole: Role; notes: string | null; documents: string[]; createdAt: string; user: Author & { bio: string | null } }

const TYPE_LABEL: Record<string, string> = { POST: 'منشور', COMMENT: 'تعليق', THREAD: 'سؤال', REPLY: 'إجابة', USER: 'مستخدم' };
const TABS = [['reports', 'البلاغات', Flag], ['verifications', 'طلبات التوثيق', BadgeCheck], ['subs', 'الاشتراكات', Crown]] as const;

export default function AdminPage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('reports');
  useEffect(() => { if (ready && (!user || user.role !== 'ADMIN')) router.replace('/'); }, [ready, user, router]);
  if (!user || user.role !== 'ADMIN') return <Spinner className="mx-auto mt-20" />;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold"><ShieldAlert className="text-gold-500" /> لوحة الإدارة</h1>
      <nav className="flex gap-1 rounded-xl border border-line bg-surface p-1" aria-label="أقسام الإدارة">
        {TABS.map(([k, label, I]) => (
          <button key={k} onClick={() => setTab(k)} aria-current={tab === k ? 'page' : undefined}
            className={clsx('flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition', tab === k ? 'bg-brand-600 text-white dark:text-[#06120d]' : 'text-mute hover:bg-brand-50')}><I size={16} /> {label}</button>
        ))}
      </nav>
      {tab === 'reports' && <Reports />}
      {tab === 'verifications' && <Verifications />}
      {tab === 'subs' && <Grant />}
    </div>
  );
}

function Reports() {
  const toast = useToast();
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [busy, setBusy] = useState('');
  const load = useCallback(() => api<ReportRow[]>('/admin/reports').then(setRows).catch((e) => { toast(e.message, 'err'); setRows([]); }), [toast]);
  useEffect(() => { void load(); }, [load]);

  async function act(id: string, kind: 'hide' | 'dismiss') {
    if (kind === 'hide' && !confirm('سيُخفى المحتوى عن العامة (وإن كان مستخدماً فسيُعطَّل حسابه). متابعة؟')) return;
    setBusy(id);
    try { await api(`/admin/reports/${id}/${kind}`, { method: 'POST' }); toast(kind === 'hide' ? 'تم الإخفاء' : 'تم التجاهل'); await load(); } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(''); }
  }
  if (!rows) return <Spinner className="mx-auto mt-10" />;
  if (!rows.length) return <EmptyState icon={<Flag />} title="لا توجد بلاغات مفتوحة" hint="ستظهر هنا البلاغات الجديدة من الأعضاء." />;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="card space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-700">{TYPE_LABEL[r.targetType] ?? r.targetType}</span>
            <span className="text-mute">بلّغ {r.reporter.displayName} · {timeAgo(r.createdAt)}</span>
            {r.href && <Link href={r.href} target="_blank" className="ms-auto inline-flex items-center gap-1 text-brand-600 hover:underline">عرض في الموقع <ExternalLink size={12} /></Link>}
          </div>
          <p className="rounded-xl bg-bg p-3 text-sm leading-7">{r.preview ?? <i className="text-mute">المحتوى لم يعد متاحاً</i>}</p>
          {r.authorName && <p className="text-xs text-mute">كاتب المحتوى: <b className="text-ink">{r.authorName}</b></p>}
          <p className="text-sm"><b>سبب البلاغ:</b> {r.reason}</p>
          <div className="flex justify-end gap-2">
            <button className="btn-outline" disabled={busy === r.id} onClick={() => act(r.id, 'dismiss')}>تجاهل</button>
            <button className="btn-primary !bg-red-600 hover:!bg-red-700" disabled={busy === r.id} onClick={() => act(r.id, 'hide')}>{busy === r.id ? <Spinner /> : 'إخفاء المحتوى'}</button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Verifications() {
  const toast = useToast();
  const [rows, setRows] = useState<VerRow[] | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const load = useCallback(() => api<VerRow[]>('/admin/verifications').then(setRows).catch((e) => { toast(e.message, 'err'); setRows([]); }), [toast]);
  useEffect(() => { void load(); }, [load]);

  async function review(id: string, kind: 'approve' | 'reject') {
    setBusy(id);
    try { await api(`/admin/verifications/${id}/${kind}`, { method: 'POST', body: { note: note[id] || undefined } }); toast(kind === 'approve' ? 'تم التوثيق' : 'تم الرفض'); await load(); } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(''); }
  }
  if (!rows) return <Spinner className="mx-auto mt-10" />;
  if (!rows.length) return <EmptyState icon={<BadgeCheck />} title="لا توجد طلبات توثيق" hint="الطلبات الجديدة تظهر هنا للمراجعة اليدوية." />;
  return (
    <ul className="space-y-3">
      {rows.map((v) => (
        <li key={v.id} className="card space-y-3 p-5">
          <div className="flex items-center gap-3">
            <Avatar name={v.user.displayName} seed={v.user.username} size={44} />
            <div className="min-w-0 flex-1"><Link href={`/u/${v.user.username}`} target="_blank" className="font-bold hover:text-brand-600">{v.user.displayName}</Link><p className="truncate text-xs text-mute">{v.user.headline ?? `@${v.user.username}`} · {timeAgo(v.createdAt)}</p></div>
            <span className="rounded-full bg-gold-500/15 px-2.5 py-1 text-xs font-bold text-gold-600">يطلب: {ROLE_LABEL[v.requestedRole]}</span>
          </div>
          {v.notes && <p className="rounded-xl bg-bg p-3 text-sm leading-7">{v.notes}</p>}
          {v.documents.length > 0 && (
            <ul className="space-y-1 text-sm">{v.documents.map((d) => <li key={d} dir="ltr" className="truncate text-start"><a className="text-brand-600 underline" href={d} target="_blank" rel="noopener noreferrer nofollow">{d}</a></li>)}</ul>
          )}
          <p className="text-xs text-mute">تحقّق من الإثبات خارج المنصة قبل الموافقة؛ الموافقة تمنح الدور فوراً.</p>
          <input className="input" placeholder="ملاحظة المراجعة (اختياري)" maxLength={500} value={note[v.id] ?? ''} onChange={(e) => setNote({ ...note, [v.id]: e.target.value })} />
          <div className="flex justify-end gap-2">
            <button className="btn-outline" disabled={busy === v.id} onClick={() => review(v.id, 'reject')}>رفض</button>
            <button className="btn-primary" disabled={busy === v.id} onClick={() => review(v.id, 'approve')}>{busy === v.id ? <Spinner /> : 'توثيق'}</button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Grant() {
  const toast = useToast();
  const [f, setF] = useState({ username: '', interval: 'MONTH', days: 30 });
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try { await api('/admin/subscriptions/grant', { method: 'POST', body: { ...f, username: f.username.trim().replace(/^@/, '') } }); toast('تم منح الاشتراك'); setF({ ...f, username: '' }); } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
  }
  return (
    <div className="card space-y-4 p-6">
      <h2 className="font-bold">منح اشتراك يدوي</h2>
      <p className="text-sm leading-7 text-mute">للمستخدمين التجريبيين أو الدفع خارج المنصة، إلى أن يُربط مزوّد دفع. يُسجَّل كمزوّد «manual».</p>
      <label className="block space-y-1.5"><span className="text-sm font-semibold">اسم المستخدم</span><input className="input" dir="ltr" placeholder="username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5"><span className="text-sm font-semibold">الباقة</span><select className="input" value={f.interval} onChange={(e) => setF({ ...f, interval: e.target.value })}><option value="MONTH">شهري</option><option value="YEAR">سنوي</option></select></label>
        <label className="block space-y-1.5"><span className="text-sm font-semibold">المدة (أيام)</span><input className="input" type="number" min={1} max={400} value={f.days} onChange={(e) => setF({ ...f, days: Number(e.target.value) })} /></label>
      </div>
      <div className="flex justify-end"><button className="btn-primary" disabled={busy || f.username.trim().length < 3} onClick={submit}>{busy ? <Spinner /> : 'منح الاشتراك'}</button></div>
    </div>
  );
}
