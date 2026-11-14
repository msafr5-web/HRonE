'use client';

import { Flag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Spinner, useToast } from './ui';

type Target = 'POST' | 'COMMENT' | 'THREAD' | 'REPLY' | 'USER';

/** Lightweight inline report form – every public surface needs one before launch. */
export function ReportButton({ type, id }: { type: Target; id: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      await api('/reports', { method: 'POST', body: { targetType: type, targetId: id, reason } });
      toast('وصلنا بلاغك، شكراً لمساعدتك في إبقاء المجتمع آمناً');
      setOpen(false);
      setReason('');
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="relative">
      <button className="btn-ghost !px-2 !py-1 text-xs" aria-label="إبلاغ عن المحتوى" onClick={() => (user ? setOpen((o) => !o) : router.push('/login'))}>
        <Flag size={14} />
      </button>
      {open && (
        <div className="card absolute left-0 top-full z-20 mt-1 w-72 animate-rise space-y-2 p-3">
          <label className="text-xs font-semibold" htmlFor={`rp-${id}`}>سبب البلاغ</label>
          <textarea id={`rp-${id}`} className="input min-h-[72px] text-sm" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: إساءة، معلومات مضللة، بيانات شخصية…" />
          <div className="flex justify-end gap-2">
            <button className="btn-ghost !py-1.5" onClick={() => setOpen(false)}>إلغاء</button>
            <button className="btn-primary !py-1.5" disabled={busy || reason.trim().length < 3} onClick={send}>{busy ? <Spinner /> : 'إرسال'}</button>
          </div>
        </div>
      )}
    </span>
  );
}
