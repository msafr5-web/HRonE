'use client';

import { MailWarning, X } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Spinner, useToast } from './ui';

/** Soft nudge (not a gate): shown while the signed-in user's email is unconfirmed. */
export function VerifyBanner() {
  const { user } = useAuth();
  const toast = useToast();
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  if (!user || user.emailVerifiedAt || hidden) return null;

  async function resend() {
    setBusy(true);
    try { await api('/auth/resend-verification', { method: 'POST' }); setSent(true); toast('أرسلنا رابط التأكيد إلى بريدك'); }
    catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
  }
  return (
    <div role="status" className="border-b border-gold-500/40 bg-gold-500/10">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 text-sm">
        <MailWarning size={18} className="shrink-0 text-gold-600" />
        <p className="flex-1">{sent ? 'تحقق من بريدك الإلكتروني واضغط رابط التأكيد.' : 'لم يتم تأكيد بريدك الإلكتروني بعد. التأكيد يتيح لك استعادة حسابك عند نسيان كلمة المرور.'}</p>
        {!sent && <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={resend} disabled={busy}>{busy ? <Spinner /> : 'إرسال رابط التأكيد'}</button>}
        <button className="btn-ghost !p-1.5" aria-label="إخفاء" onClick={() => setHidden(true)}><X size={16} /></button>
      </div>
    </div>
  );
}
